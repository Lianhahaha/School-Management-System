/**
 * Student profiles: creation and deletion (called by users.service inside its transaction),
 * reads with role scoping, admin edits.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { todayYmd } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import * as repo from './students.repository.js';

/** The student-specific columns, as exposed in `profile` and inside the student shape. */
export const toStudentProfile = (row) => ({
  id: row.id,
  studentNumber: row.studentNumber,
  lrn: row.lrn,
  dateOfBirth: row.dateOfBirth,
  gender: row.gender,
  address: row.address,
  guardianName: row.guardianName,
  guardianPhone: row.guardianPhone,
  admissionDate: row.admissionDate,
});

export const toCurrentEnrollment = (row) =>
  row.enrollmentId
    ? {
        id: row.enrollmentId,
        classId: row.classId,
        className: row.className,
        gradeLevel: row.gradeLevel,
        academicYear: row.academicYear,
        status: row.enrollmentStatus,
        enrolledOn: row.enrolledOn,
      }
    : null;

const toStudentShape = (row) => ({
  ...toStudentProfile(row),
  userId: row.userId,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
  phone: row.phone,
  isActive: row.isActive,
  currentEnrollment: toCurrentEnrollment(row),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** `{ profile, currentEnrollment }` of a student user, for the account shape. */
export async function getProfileByUserId(userId) {
  // A student account always has its profile row; a missing one (a manual fix gone wrong) is a 404, not a crash.
  const row = ApiError.assertFound(await repo.findStudentByUserId(userId), 'student profile', userId);
  return { profile: toStudentProfile(row), currentEnrollment: toCurrentEnrollment(row) };
}

/**
 * Insert the profile row for a new student user. Generates STU-<year>-NNNN
 * (year = admission year) when no number is supplied. Runs inside the caller's
 * transaction; the caller regenerates the number when it collides (users.service, up to 5 attempts).
 */
export async function createProfile(userId, profile = {}, conn) {
  const admissionDate = profile.admissionDate ?? todayYmd();
  let studentNumber = profile.studentNumber;
  if (!studentNumber) {
    const year = admissionDate.slice(0, 4);
    const next = (await repo.maxStudentSequence(year, conn)) + 1;
    studentNumber = `STU-${year}-${String(next).padStart(4, '0')}`;
  }
  return repo.insertStudent(userId, { ...profile, studentNumber, admissionDate }, conn);
}

/** Remove the profile row of a student user that is being deleted. Runs inside the caller's transaction. */
export const deleteProfile = (userId, conn) => repo.deleteStudentByUserId(userId, conn);

export async function listStudents(user, listQuery) {
  if (listQuery.classId !== undefined) await access.assertCanViewClass(user, listQuery.classId);
  const { rows, meta } = await repo.listStudents(listQuery, access.classScope(user, 'e.class_id'));
  return { data: rows.map(toStudentShape), meta };
}

export async function getStudent(user, idOrMe) {
  const id = resolveMe(user, idOrMe, 'student');
  await access.assertCanViewStudent(user, id);
  return toStudentShape(ApiError.assertFound(await repo.findStudentById(id), 'student', id));
}

/**
 * Admin edit, and the student's own contact update (through PATCH /auth/me): users + students columns in
 * one statement.
 */
export async function updateStudent(id, patch) {
  const before = ApiError.assertFound(await repo.findStudentById(id), 'student', id);
  await withTransaction((conn) => repo.updateStudent(id, patch, conn));
  const student = toStudentShape(await repo.findStudentById(id));
  const changes = changesOf(before, patch);
  if (changes) {
    await record({
      action: 'student.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of student ${nameOf(student)}`,
      details: { studentNumber: student.studentNumber, changes },
    });
  }
  return student;
}
