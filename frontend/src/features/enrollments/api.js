import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * params: page, limit, sortBy, sortOrder, studentId ('me' allowed), classId, status, academicYear.
 * This list does not accept `search`.
 */
export const listEnrollments = (params) => api.get('/enrollments', { params }).then(toPage);

/**
 * Admin only. Opens an enrollment. 409 `activeEnrollmentId` when the student is already enrolled.
 * Here, in bulk and in a transfer, a class of a past academic year is refused with
 * `details.reason` 'past_academic_year'.
 */
export const enrollStudent = ({ studentId, classId }) =>
  api.post('/enrollments', { studentId, classId }).then(toData);

/** Admin only, all or nothing. Resolves { classId, created, enrollments }; 409 `alreadyActive[]`. */
export const enrollStudents = ({ classId, studentIds }) =>
  api.post('/enrollments/bulk', { classId, studentIds }).then(toData);

/** Admin only. Closes the active enrollment as `transferred` and opens the new one, in one transaction. */
export const transferStudent = ({ studentId, classId }) =>
  api.post('/enrollments/transfer', { studentId, classId }).then(toData);

/**
 * Admin only, all or nothing. Closes the students' enrollments in `classId` as completed and, with
 * `nextClassId` (a class of a later year), enrolls them there. Resolves
 * { classId, nextClassId, completed, enrollments }; 409 `not_active_in_class` lists `invalidStudentIds`.
 */
export const completeSchoolYear = ({ classId, studentIds, nextClassId }) =>
  api.post('/enrollments/complete', { classId, studentIds, nextClassId }).then(toData);

/**
 * Student only. Where the signed-in student stands for next year (DepEd promotion rules): { status, lastClass,
 * generalAverage, failedSubjects, gradeLevel, academicYear, classes }; status is one of NEXT_CLASS_STANDINGS.
 */
export const getNextClass = () => api.get('/enrollments/next-class').then(toData);

/**
 * Student only. Enrolls the signed-in student in one of the offered sections. 409 `not_eligible` when the
 * standing does not allow it, 400 `class_not_offered` for another class.
 */
export const enrollMyself = (classId) => api.post('/enrollments/next-class', { classId }).then(toData);

/** Admin only. Closes an active enrollment: status is 'completed' or 'withdrawn'. */
export const setEnrollmentStatus = (id, status) => api.patch(`/enrollments/${id}`, { status }).then(toData);
