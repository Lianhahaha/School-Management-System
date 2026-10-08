/**
 * Enrollment workflow. A student has at most one active enrollment (enforced by
 * the database); a transfer closes the old row and opens the new one in a single
 * transaction. Every enrollment is a new row, also a return to a class the
 * student left, so each period in a class stays on record for dated rosters.
 * Only classes of the current or a future academic year accept students.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { todayYmd } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyStudents } from '../notifications/notifications.service.js';
import { assertEnrollableClass } from '../classes/classes.service.js';
import * as repo from './enrollments.repository.js';

const toEnrollmentShape = (row) => ({
  id: row.id,
  studentId: row.studentId,
  student: {
    id: row.studentId,
    studentNumber: row.studentNumber,
    firstName: row.firstName,
    lastName: row.lastName,
  },
  classId: row.classId,
  class: { id: row.classId, name: row.className, gradeLevel: row.gradeLevel, academicYear: row.academicYear },
  status: row.status,
  enrolledOn: row.enrolledOn,
  leftOn: row.leftOn,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listEnrollments(user, listQuery) {
  const studentId = access.scopedStudentId(user, resolveMe(user, listQuery.studentId, 'student'));
  if (listQuery.classId !== undefined) await access.assertCanViewClass(user, listQuery.classId);
  // Students see their own whole history (no class scope); teachers only enrollments of visible classes.
  const scope = access.isStudent(user) ? null : access.classScope(user, 'e.class_id');
  const { rows, meta } = await repo.listEnrollments({ ...listQuery, studentId }, scope);
  return { data: rows.map(toEnrollmentShape), meta };
}

export async function getEnrollment(user, id) {
  const row = ApiError.assertFound(await repo.findEnrollmentById(id), 'enrollment', id);
  if (access.isStudent(user)) access.scopedStudentId(user, row.studentId);
  else await access.assertCanViewClass(user, row.classId);
  return toEnrollmentShape(row);
}

/** 400 listing the ids that do not exist, or that belong to deactivated students. */
async function assertEnrollable(studentIds, conn) {
  const found = await repo.findStudentsActivity(studentIds, conn);
  const activeIds = new Set(found.filter((student) => student.isActive).map((student) => student.id));
  const invalidStudentIds = studentIds.filter((id) => !activeIds.has(id));
  if (invalidStudentIds.length) {
    throw ApiError.validation('students do not exist or are deactivated', undefined, {
      reason: 'student_not_enrollable',
      invalidStudentIds,
    });
  }
}

const alreadyEnrolled = (active) =>
  ApiError.conflict('student already has an active enrollment', {
    reason: 'already_enrolled',
    activeEnrollmentId: active.id,
    classId: active.classId,
  });

const someAlreadyEnrolled = (activeRows) =>
  ApiError.conflict('some students already have an active enrollment', {
    reason: 'already_enrolled',
    alreadyActive: activeRows.map((row) => ({
      studentId: row.studentId,
      enrollmentId: row.id,
      classId: row.classId,
    })),
  });

const isOneActiveCollision = (error) =>
  error?.code === 'ER_DUP_ENTRY' && /uq_enrollments_one_active/.test(error.sqlMessage ?? '');

/**
 * Runs an enrolling transaction. The service checks for an active enrollment first; when another
 * request enrolls the same student in between, the unique index refuses the insert, and this turns
 * that into the same 409 the check gives (read after the rollback, so the other row is visible).
 */
async function enrollingTransaction(studentIds, work) {
  try {
    return await withTransaction(work);
  } catch (error) {
    if (!isOneActiveCollision(error)) throw error;
    const active = await repo.findActiveByStudents(studentIds);
    throw active.length === 1 && studentIds.length === 1
      ? alreadyEnrolled(active[0])
      : someAlreadyEnrolled(active);
  }
}

export async function enroll({ studentId, classId }) {
  const id = await enrollingTransaction([studentId], async (conn) => {
    await assertEnrollable([studentId], conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudent(studentId, conn);
    if (active) throw alreadyEnrolled(active);
    return repo.insertEnrollment(studentId, classId, todayYmd(), conn);
  });
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await record({
    action: 'enrollment.create',
    entityId: id,
    summary: `Enrolled ${nameOf(enrollment.student)} in ${enrollment.class.name}, ${enrollment.class.academicYear}`,
    details: { student: nameOf(enrollment.student), className: enrollment.class.name },
  });
  await notifyStudents([
    {
      studentId: enrollment.studentId,
      type: 'enrollment',
      title: `You are enrolled in ${enrollment.class.name}`,
      body: enrollment.class.academicYear,
      link: '/student/class',
    },
  ]);
  return enrollment;
}

/** All-or-nothing: nothing is written when the class or any student is invalid or already enrolled. */
export async function enrollMany({ classId, studentIds }) {
  const ids = await enrollingTransaction(studentIds, async (conn) => {
    await assertEnrollable(studentIds, conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudents(studentIds, conn);
    if (active.length) throw someAlreadyEnrolled(active);
    const today = todayYmd();
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, classId, today, conn));
    }
    return created;
  });
  // One query for the whole batch: a query per row would exhaust the connection pool on large batches.
  const enrollments = (await repo.findEnrollmentsByIds(ids)).map(toEnrollmentShape);
  const { class: klass } = enrollments[0];
  await record({
    action: 'enrollment.create',
    summary: `Enrolled ${ids.length} student${ids.length === 1 ? '' : 's'} in ${klass.name}, ${klass.academicYear}`,
    details: { className: klass.name, students: enrollments.map((enrollment) => nameOf(enrollment.student)) },
  });
  await notifyStudents(
    enrollments.map((enrollment) => ({
      studentId: enrollment.studentId,
      type: 'enrollment',
      title: `You are enrolled in ${enrollment.class.name}`,
      body: enrollment.class.academicYear,
      link: '/student/class',
    })),
  );
  return { classId, created: ids.length, enrollments };
}

/** Move a student to another class: close the active row as `transferred`, then open the new one. */
export async function transfer({ studentId, classId }) {
  let fromClass;
  const id = await enrollingTransaction([studentId], async (conn) => {
    await assertEnrollable([studentId], conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudent(studentId, conn);
    if (!active) {
      throw ApiError.conflict('student has no active enrollment; enroll them instead', {
        reason: 'no_active_enrollment',
      });
    }
    if (active.classId === classId) {
      throw ApiError.conflict('student is already enrolled in this class', { reason: 'same_class', classId });
    }
    // One date for both rows: the student leaves the old class and joins the new one on the same day.
    const today = todayYmd();
    // Another request (a withdrawal, a deactivation) may have closed the row since it was read.
    if ((await repo.closeEnrollment(active.id, 'transferred', today, conn)) === 0) {
      throw ApiError.conflict('the enrollment was closed meanwhile; reload and try again', {
        reason: 'invalid_status_transition',
      });
    }
    fromClass = active.className;
    return repo.insertEnrollment(studentId, classId, today, conn);
  });
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await record({
    action: 'enrollment.transfer',
    entityId: id,
    summary: `Moved ${nameOf(enrollment.student)} from ${fromClass} to ${enrollment.class.name}`,
    details: { student: nameOf(enrollment.student), fromClass, toClass: enrollment.class.name },
  });
  await notifyStudents([
    {
      studentId: enrollment.studentId,
      type: 'enrollment',
      title: `You moved to ${enrollment.class.name}`,
      body: `From ${fromClass}`,
      link: '/student/class',
    },
  ]);
  return enrollment;
}

/** Close an active enrollment as `completed` or `withdrawn`. Closed rows cannot be changed. */
export async function setStatus(id, status) {
  const alreadyClosed = (from) =>
    ApiError.conflict(`enrollment is already ${from}`, {
      reason: 'invalid_status_transition',
      from,
      to: status,
    });
  const row = ApiError.assertFound(await repo.findEnrollmentById(id), 'enrollment', id);
  if (row.status !== 'active') throw alreadyClosed(row.status);
  await withTransaction(async (conn) => {
    // Another request (a transfer, a second admin) may have closed it since the check above.
    if ((await repo.closeEnrollment(id, status, todayYmd(), conn)) === 0) {
      throw alreadyClosed((await repo.findEnrollmentById(id, conn)).status);
    }
  });
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await record({
    action: 'enrollment.close',
    entityId: id,
    summary: `Closed ${nameOf(enrollment.student)}'s enrollment in ${enrollment.class.name} as ${status}`,
    details: { student: nameOf(enrollment.student), className: enrollment.class.name, status },
  });
  return enrollment;
}

/** Withdraw the student's active enrollment, if any (used when an account is deactivated). */
export function closeActiveForStudent(studentId, status, conn) {
  return repo.closeActiveByStudent(studentId, status, todayYmd(), conn);
}
