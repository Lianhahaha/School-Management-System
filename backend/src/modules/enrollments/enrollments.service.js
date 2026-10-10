/**
 * Enrollment workflow. A student has at most one active enrollment (enforced by
 * the database); a transfer closes the old row and opens the new one in a single
 * transaction. Every enrollment is a new row, also a return to a class the
 * student left, so each period in a class stays on record for dated rosters.
 * Only classes of the current or a future academic year accept students.
 * The end of a school year closes a class's rows as `completed` and can move the students on in one step.
 * After that a student may enroll themselves in a section of the grade level their results allow; those
 * DepEd promotion rules live in promotion.service.js.
 * Enrolling a self-registered applicant admits them (admissions), in the same transaction.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear, todayYmd } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { admit } from '../admissions/admissions.service.js';
import { notifyStudents, resolveSignups } from '../notifications/notifications.service.js';
import { assertEnrollableClass, findReferencedClass } from '../classes/classes.service.js';
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
  // A student's rows are already limited to themselves, so filtering by a class they left is fine.
  if (listQuery.classId !== undefined && !access.isStudent(user)) {
    await access.assertCanViewClass(user, listQuery.classId);
  }
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

/** The bell notification of a student who joined `enrollment`'s class. */
const enrollmentNote = (enrollment, title, body) => ({
  studentId: enrollment.studentId,
  type: 'enrollment',
  title,
  body,
  link: '/student/class',
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

/**
 * Opens an active enrollment in `classId` for each student, all or nothing, and returns the new ids in order.
 * Nothing is written when the class or any student is invalid or already in a class; `refusal(activeRows)`
 * builds that 409 (one student or a list). The applicants among them (pending or declined) are admitted.
 */
function enrollInClass(classId, studentIds, refusal) {
  return enrollingTransaction(studentIds, async (conn) => {
    await assertEnrollable(studentIds, conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudents(studentIds, conn);
    if (active.length) throw refusal(active);
    const today = todayYmd();
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, classId, today, conn));
    }
    await admit(studentIds, conn);
    return created;
  });
}

/** One activity entry for the new enrollments (all in one class) and a bell notification for each student. */
async function announceEnrollments(enrollments) {
  const [first] = enrollments;
  const { name: className, academicYear } = first.class;
  const names = enrollments.map((enrollment) => nameOf(enrollment.student));
  await record({
    action: 'enrollment.create',
    ...(enrollments.length === 1
      ? {
          entityId: first.id,
          summary: `Enrolled ${names[0]} in ${className}, ${academicYear}`,
          details: { student: names[0], className },
        }
      : {
          summary: `Enrolled ${enrollments.length} students in ${className}, ${academicYear}`,
          details: { className, students: names },
        }),
  });
  await notifyStudents(
    enrollments.map((enrollment) =>
      enrollmentNote(enrollment, `You are enrolled in ${className}`, academicYear),
    ),
  );
  await resolveSignups(enrollments.map((enrollment) => enrollment.student.id));
}

export async function enroll({ studentId, classId }) {
  const [id] = await enrollInClass(classId, [studentId], (active) => alreadyEnrolled(active[0]));
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await announceEnrollments([enrollment]);
  return enrollment;
}

/** All-or-nothing: nothing is written when the class or any student is invalid or already enrolled. */
export async function enrollMany({ classId, studentIds }) {
  const ids = await enrollInClass(classId, studentIds, someAlreadyEnrolled);
  // One query for the whole batch: a query per row would exhaust the connection pool on large batches.
  const enrollments = (await repo.findEnrollmentsByIds(ids)).map(toEnrollmentShape);
  await announceEnrollments(enrollments);
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
    if ((await repo.closeEnrollments([active.id], 'transferred', today, conn)) === 0) {
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
    enrollmentNote(enrollment, `You moved to ${enrollment.class.name}`, `From ${fromClass}`),
  ]);
  return enrollment;
}

/**
 * The end of a school year for one class: the listed students' active enrollments in `classId` close as
 * `completed` and, with `nextClassId`, they join that class of a later year. All or nothing; students of the
 * class who are not listed stay active. Both rows carry today's date, as in a transfer, so this belongs after
 * the last school day: from today the students leave this class's sheets, earlier days stay editable.
 */
export async function completeYear({ classId, studentIds, nextClassId }) {
  let klass;
  let next = null;
  let closedIds = [];
  const createdIds = await enrollingTransaction(studentIds, async (conn) => {
    // Runs for one class are serialised on the class row: a second run waits, then finds the students closed
    // (locking only the enrollment rows lets two runs deadlock on the index gaps their updates touch).
    klass = await findReferencedClass(classId, 'classId', conn, { forUpdate: true });
    // A completed row can never be reopened, so a year that has not started cannot be closed by mistake.
    if (klass.academicYear > currentAcademicYear()) {
      throw ApiError.validation(`the ${klass.academicYear} school year has not started yet`, undefined, {
        reason: 'year_not_started',
        field: 'classId',
        academicYear: klass.academicYear,
      });
    }
    if (nextClassId !== undefined) {
      next = await assertEnrollableClass(nextClassId, conn, 'nextClassId');
      if (next.academicYear <= klass.academicYear) {
        throw ApiError.validation('the next class must belong to a later school year', undefined, {
          reason: 'not_later_academic_year',
          field: 'nextClassId',
          academicYear: next.academicYear,
        });
      }
      await assertEnrollable(studentIds, conn);
    }
    // Locked until commit: a transfer or withdrawal of one of these students waits, then finds the row closed.
    const active = await repo.findActiveByStudents(studentIds, conn, { forUpdate: true });
    const inClass = new Map(
      active.filter((row) => row.classId === classId).map((row) => [row.studentId, row.id]),
    );
    const invalidStudentIds = studentIds.filter((studentId) => !inClass.has(studentId));
    if (invalidStudentIds.length) {
      throw ApiError.conflict('some students are not active in this class', {
        reason: 'not_active_in_class',
        classId,
        invalidStudentIds,
      });
    }
    const today = todayYmd();
    closedIds = studentIds.map((studentId) => inClass.get(studentId));
    await repo.closeEnrollments(closedIds, 'completed', today, conn);
    if (!next) return [];
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, nextClassId, today, conn));
    }
    return created;
  });

  const closed = (await repo.findEnrollmentsByIds(closedIds)).map(toEnrollmentShape);
  const enrollments = (await repo.findEnrollmentsByIds(createdIds)).map(toEnrollmentShape);
  const count = `${closed.length} student${closed.length === 1 ? '' : 's'}`;
  await record({
    action: 'enrollment.complete',
    summary: `Completed the ${klass.academicYear} school year of ${count} in ${klass.name}${
      next ? `, now in ${next.name}, ${next.academicYear}` : ''
    }`,
    details: {
      className: klass.name,
      academicYear: klass.academicYear,
      ...(next && { nextClass: `${next.name}, ${next.academicYear}` }),
      students: closed.map((enrollment) => nameOf(enrollment.student)),
    },
  });
  await notifyStudents(
    enrollments.map((enrollment) =>
      enrollmentNote(
        enrollment,
        `You are enrolled in ${enrollment.class.name}`,
        `${enrollment.class.academicYear} · ${klass.name} completed`,
      ),
    ),
  );
  return { classId, nextClassId: next?.id ?? null, completed: closed.length, enrollments };
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
    if ((await repo.closeEnrollments([id], status, todayYmd(), conn)) === 0) {
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
