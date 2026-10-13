/**
 * Ownership and visibility policy: the only place these rules exist.
 *
 *   admin     : no restrictions.
 *   assistant : a student assistant. Reads like an admin (the whole school);
 *               writes only what its routes allow, never grades or attendance
 *               (assertCanManageClassSubject). The admin and the assistant
 *               together are "the office" (isOffice). An assistant who signed
 *               up has no access at all until the office approves the request
 *               (isAwaitingApproval, checked by `authenticate` on every request).
 *   teacher   : "visible" = classes they teach a subject in, or are homeroom
 *               teacher of (reads); "owns" = class-subjects where they are the
 *               assigned teacher (writes).
 *   student   : own records and the class of their active enrollment.
 *
 * Every `assert*` throws 403 FORBIDDEN with a stable `details.reason`.
 * List endpoints follow one rule: rows are always limited to the caller's scope (`classScope`,
 * `scopedStudentId`). An explicit class or class-subject filter outside it is a 403
 * (`assertFiltersInScope`), as is a student asking for another student; other filters (a student,
 * teacher or assessment id from a teacher) only narrow the rows within the scope, so a foreign id
 * simply matches nothing. A student's own records (`scopeRecordFilters`) are the exception: their rows
 * are always their own, so a class filter only narrows them, also to a class they have left.
 */
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as repo from './access.repository.js';

export const isAdmin = (user) => user.role === 'admin';
export const isAssistant = (user) => user.role === 'assistant';
export const isTeacher = (user) => user.role === 'teacher';
export const isStudent = (user) => user.role === 'student';

/**
 * A student assistant the school office has approved. `assistantRequestStatus` is loaded with the user on every
 * request (authenticate): null for an assistant created before assistants signed up themselves, who counts as
 * approved. A user object without the field (not loaded by authenticate) does not count.
 */
export const isApprovedAssistant = (user) =>
  isAssistant(user) && (user.assistantRequestStatus === null || user.assistantRequestStatus === 'approved');

/** A student assistant whose sign-up is pending or declined: no access beyond their own account (/auth/me). */
export const isAwaitingApproval = (user) => isAssistant(user) && !isApprovedAssistant(user);

/**
 * The school office: an admin or an approved student assistant. School-wide reads, and the office work both may
 * do. `authenticate` already turns an unapproved assistant away; requiring the approval here too is a backstop.
 */
export const isOffice = (user) => isAdmin(user) || isApprovedAssistant(user);

/**
 * 403 `role_not_allowed` unless the caller is an admin: the admin-only part of an operation the office
 * shares (a student assistant creates student and teacher accounts and edits student accounts only).
 */
export function assertAdmin(user, message) {
  if (!isAdmin(user)) throw ApiError.forbidden('role_not_allowed', message);
}

/** 403 `role_not_allowed` unless the caller is the school office (an admin or an approved assistant). */
export function assertOffice(user, message = 'only the school office can do this') {
  if (!isOffice(user)) throw ApiError.forbidden('role_not_allowed', message);
}

export async function assertCanViewClass(user, classId) {
  if (isOffice(user)) return;
  if (isTeacher(user) && (await repo.teacherCanViewClass(user.teacherId, classId))) return;
  if (isStudent(user) && classId != null && user.activeClassId === classId) return;
  throw ApiError.forbidden('class_not_visible', 'you do not have access to this class');
}

export async function assertCanViewClassSubject(user, classSubjectId) {
  if (isOffice(user)) return;
  if (isTeacher(user) && (await repo.teacherCanViewClassSubject(user.teacherId, classSubjectId))) return;
  if (isStudent(user) && user.activeClassId != null) {
    if ((await repo.classIdOfClassSubject(classSubjectId)) === user.activeClassId) return;
  }
  throw ApiError.forbidden(
    'class_subject_not_visible',
    'you do not have access to this subject of the class',
  );
}

/** Attendance, assessments and grades of a class-subject: its teacher or an admin, never an assistant. */
export async function assertCanManageClassSubject(user, classSubjectId) {
  if (isAdmin(user)) return;
  if (isTeacher(user) && (await repo.teacherOwnsClassSubject(user.teacherId, classSubjectId))) return;
  throw ApiError.forbidden(
    'not_class_subject_owner',
    'only the assigned teacher can modify this class subject',
  );
}

export async function assertCanViewStudent(user, studentId) {
  if (isOffice(user)) return;
  if (isStudent(user) && user.studentId === studentId) return;
  if (isTeacher(user) && (await repo.teacherCanViewStudent(user.teacherId, studentId))) return;
  throw ApiError.forbidden('student_not_visible', 'you do not have access to this student');
}

/** Reading a teacher's profile: the office reads any, a teacher their own. */
export function assertIsSelfTeacher(user, teacherId) {
  if (isOffice(user)) return;
  if (isTeacher(user) && user.teacherId === teacherId) return;
  throw ApiError.forbidden('not_self', 'you can only access your own profile');
}

/** Editing or deleting an announcement: its author, or the office (any announcement). */
export function assertIsAuthor(user, authorId) {
  if (isOffice(user)) return;
  if (user.id === authorId) return;
  throw ApiError.forbidden('not_author', 'only the author can modify this announcement');
}

/**
 * Resolves the effective `studentId` filter. Students are always limited to
 * themselves (an explicit foreign id is a 403); teachers and the office keep the
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
 * null for the office. `classColumn` is the SQL column holding the class id (e.g. 'e.class_id').
 */
export function classScope(user, classColumn) {
  if (isOffice(user)) return null;
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
 * the office).
 *
 * A student's class and class-subject filters are not checked against the class they are in now: their rows
 * are limited to themselves anyway, and their marks and grades of an earlier class (a past school year, a
 * class they moved out of) are theirs to read and filter too.
 */
export async function scopeRecordFilters(user, filters) {
  if (!isStudent(user)) await assertFiltersInScope(user, filters);
  const studentId = scopedStudentId(user, resolveMe(user, filters.studentId, 'student'));
  const scope = isStudent(user) ? null : classScope(user, 'cs.class_id');
  return { filters: { ...filters, studentId }, scope };
}
