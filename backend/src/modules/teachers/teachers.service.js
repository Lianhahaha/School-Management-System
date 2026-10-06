/**
 * Teacher profiles: creation and deletion (called by users.service inside its transaction),
 * reads with role scoping, admin edits, and the "is this teacher assignable" check.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { todayYmd } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import * as repo from './teachers.repository.js';

/** The teacher-specific columns, as exposed in `profile` and inside the teacher shape. */
export const toTeacherProfile = (row) => ({
  id: row.id,
  employeeNumber: row.employeeNumber,
  hireDate: row.hireDate,
  department: row.department,
  qualification: row.qualification,
});

const toTeacherShape = (row) => ({
  ...toTeacherProfile(row),
  userId: row.userId,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
  phone: row.phone,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** The `profile` object of a teacher user, for the account shape. */
export async function getProfileByUserId(userId) {
  return toTeacherProfile(await repo.findTeacherByUserId(userId));
}

/**
 * Insert the profile row for a new teacher user. Generates EMP-<year>-NNNN
 * (year = hire year) when no number is supplied. Runs inside the caller's transaction.
 */
export async function createProfile(userId, profile = {}, conn) {
  const hireDate = profile.hireDate ?? todayYmd();
  let employeeNumber = profile.employeeNumber;
  if (!employeeNumber) {
    const year = hireDate.slice(0, 4);
    const next = (await repo.maxEmployeeSequence(year, conn)) + 1;
    employeeNumber = `EMP-${year}-${String(next).padStart(4, '0')}`;
  }
  return repo.insertTeacher(userId, { ...profile, employeeNumber, hireDate }, conn);
}

/** Remove the profile row of a teacher user that is being deleted. Runs inside the caller's transaction. */
export const deleteProfile = (userId, conn) => repo.deleteTeacherByUserId(userId, conn);

/** 400 when the teacher does not exist or is deactivated (used before assigning a teacher to work). */
export async function assertActiveTeacher(teacherId, conn) {
  const teacher = await repo.findTeacherById(teacherId, conn);
  if (!teacher)
    throw ApiError.validation('teacher does not exist', undefined, {
      reason: 'invalid_reference',
      field: 'teacherId',
    });
  if (!teacher.isActive)
    throw ApiError.validation('this teacher is deactivated', undefined, {
      reason: 'teacher_inactive',
      field: 'teacherId',
    });
}

export async function listTeachers(listQuery) {
  const { rows, meta } = await repo.listTeachers(listQuery);
  return { data: rows.map(toTeacherShape), meta };
}

export async function getTeacher(user, idOrMe) {
  const id = resolveMe(user, idOrMe, 'teacher');
  access.assertIsSelfTeacher(user, id);
  return toTeacherShape(ApiError.assertFound(await repo.findTeacherById(id), 'teacher', id));
}

export async function updateTeacher(id, patch) {
  const before = ApiError.assertFound(await repo.findTeacherById(id), 'teacher', id);
  await withTransaction((conn) => repo.updateTeacher(id, patch, conn));
  const teacher = toTeacherShape(await repo.findTeacherById(id));
  const changes = changesOf(before, patch);
  if (changes) {
    await record({
      action: 'teacher.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of teacher ${nameOf(teacher)}`,
      details: { employeeNumber: teacher.employeeNumber, changes },
    });
  }
  return teacher;
}
