/**
 * Ownership and visibility policy: the only place these rules exist.
 *
 *   admin    : no restrictions.
 *   teacher  : "visible" = classes they teach a subject in, or are homeroom
 *              teacher of (reads); "owns" = class-subjects where they are the
 *              assigned teacher (writes).
 *   student  : own records and the class of their active enrollment.
 *
 * Every `assert*` throws 403 FORBIDDEN with a stable `details.reason`.
 * List endpoints follow one rule: rows are always limited to the caller's scope (`classScope`,
 * `scopedStudentId`). An explicit class or class-subject filter outside it is a 403
 * (`assertFiltersInScope`), as is a student asking for another student; other filters (a student,
 * teacher or assessment id from a teacher) only narrow the rows within the scope, so a foreign id
 * simply matches nothing.
 */
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as repo from './access.repository.js';

export const isAdmin = (user) => user.role === 'admin';
export const isTeacher = (user) => user.role === 'teacher';
export const isStudent = (user) => user.role === 'student';

export async function assertCanViewClass(user, classId) {
  if (isAdmin(user)) return;
  if (isTeacher(user) && (await repo.teacherCanViewClass(user.teacherId, classId))) return;
  if (isStudent(user) && classId != null && user.activeClassId === classId) return;
  throw ApiError.forbidden('class_not_visible', 'you do not have access to this class');
}

export async function assertCanViewClassSubject(user, classSubjectId) {
  if (isAdmin(user)) return;
  if (isTeacher(user) && (await repo.teacherCanViewClassSubject(user.teacherId, classSubjectId))) return;
  if (isStudent(user) && user.activeClassId != null) {
    if ((await repo.classIdOfClassSubject(classSubjectId)) === user.activeClassId) return;
  }
  throw ApiError.forbidden(
    'class_subject_not_visible',
    'you do not have access to this subject of the class',
  );
}

export async function assertCanManageClassSubject(user, classSubjectId) {
  if (isAdmin(user)) return;
  if (isTeacher(user) && (await repo.teacherOwnsClassSubject(user.teacherId, classSubjectId))) return;
  throw ApiError.forbidden(
    'not_class_subject_owner',
    'only the assigned teacher can modify this class subject',
  );
}

export async function assertCanViewStudent(user, studentId) {
  if (isAdmin(user)) return;
  if (isStudent(user) && user.studentId === studentId) return;
  if (isTeacher(user) && (await repo.teacherCanViewStudent(user.teacherId, studentId))) return;
  throw ApiError.forbidden('student_not_visible', 'you do not have access to this student');
}

export function assertIsSelfTeacher(user, teacherId) {
  if (isAdmin(user)) return;
  if (isTeacher(user) && user.teacherId === teacherId) return;
  throw ApiError.forbidden('not_self', 'you can only access your own profile');
}

export function assertIsAuthor(user, authorId) {
  if (isAdmin(user)) return;
  if (user.id === authorId) return;
  throw ApiError.forbidden('not_author', 'only the author can modify this announcement');
}

/**
 * Resolves the effective `studentId` filter. Students are always limited to
 * themselves (an explicit foreign id is a 403); teachers and admins keep the
 * requested value (their class scope applies separately).
 */
export function scopedStudentId(user, requested) {
  if (!isStudent(user)) return requested;
  if (requested !== undefined && requested !== user.studentId) {
    throw ApiError.forbidden('student_not_self', 'students can only read their own records');
  }
  return user.studentId;
}

/**
 * WHERE fragment `{ sql, params }` restricting rows to the caller's classes, or
 * null for admins. `classColumn` is the SQL column holding the class id (e.g. 'e.class_id').
 */
export function classScope(user, classColumn) {
  if (isAdmin(user)) return null;
  if (isTeacher(user)) {
    return {
      sql: `${classColumn} IN ${repo.VISIBLE_CLASS_IDS_SQL}`,
      params: repo.visibleClassParams(user.teacherId),
    };
  }
  if (user.activeClassId == null) return { sql: '1 = 0', params: [] };
  return { sql: `${classColumn} = ?`, params: [user.activeClassId] };
}

/** Validates the optional classId / classSubjectId filters of a list query against the caller's scope. */
export async function assertFiltersInScope(user, { classId, classSubjectId }) {
  if (classId !== undefined) await assertCanViewClass(user, classId);
  if (classSubjectId !== undefined) await assertCanViewClassSubject(user, classSubjectId);
}

/**
 * The scoping rule of the student records kept per class-subject (attendance marks, grades), shared by their
 * lists and summaries: own records for students, visible classes for teachers. Returns the `filters` with
 * the effective `studentId` (`me` resolved) and the class `scope` on `cs.class_id` (null for students and
 * admins).
 */
export async function scopeRecordFilters(user, filters) {
  await assertFiltersInScope(user, filters);
  const studentId = scopedStudentId(user, resolveMe(user, filters.studentId, 'student'));
  const scope = isStudent(user) ? null : classScope(user, 'cs.class_id');
  return { filters: { ...filters, studentId }, scope };
}
