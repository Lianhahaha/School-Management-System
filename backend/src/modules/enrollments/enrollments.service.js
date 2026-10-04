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

export async function enroll({ studentId, classId }) {
  const id = await withTransaction(async (conn) => {
    await assertEnrollable([studentId], conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudent(studentId, conn);
    if (active) throw alreadyEnrolled(active);
    return repo.insertEnrollment(studentId, classId, todayYmd(), conn);
  });
  return toEnrollmentShape(await repo.findEnrollmentById(id));
}

/** All-or-nothing: nothing is written when the class or any student is invalid or already enrolled. */
export async function enrollMany({ classId, studentIds }) {
  const ids = await withTransaction(async (conn) => {
    await assertEnrollable(studentIds, conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudents(studentIds, conn);
    if (active.length) {
      throw ApiError.conflict('some students already have an active enrollment', {
        reason: 'already_enrolled',
        alreadyActive: active.map((row) => ({
          studentId: row.studentId,
          enrollmentId: row.id,
          classId: row.classId,
        })),
      });
    }
    const today = todayYmd();
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, classId, today, conn));
    }
    return created;
  });
  const enrollments = await Promise.all(ids.map((id) => repo.findEnrollmentById(id)));
  return { classId, created: ids.length, enrollments: enrollments.map(toEnrollmentShape) };
}

/** Move a student to another class: close the active row as `transferred`, then open the new one. */
export async function transfer({ studentId, classId }) {
  const id = await withTransaction(async (conn) => {
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
    await repo.closeEnrollment(active.id, 'transferred', today, conn);
    return repo.insertEnrollment(studentId, classId, today, conn);
  });
  return toEnrollmentShape(await repo.findEnrollmentById(id));
}

/** Close an active enrollment as `completed` or `withdrawn`. Closed rows cannot be changed. */
export async function setStatus(id, status) {
  const row = ApiError.assertFound(await repo.findEnrollmentById(id), 'enrollment', id);
  if (row.status !== 'active') {
    throw ApiError.conflict(`enrollment is already ${row.status}`, {
      reason: 'invalid_status_transition',
      from: row.status,
      to: status,
    });
  }
  await withTransaction((conn) => repo.closeEnrollment(id, status, todayYmd(), conn));
  return toEnrollmentShape(await repo.findEnrollmentById(id));
}

/** Withdraw the student's active enrollment, if any (used when an account is deactivated). */
export function closeActiveForStudent(studentId, status, conn) {
  return repo.closeActiveByStudent(studentId, status, todayYmd(), conn);
}
