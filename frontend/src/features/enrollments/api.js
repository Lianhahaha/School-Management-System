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

/** Admin only. Closes an active enrollment: status is 'completed' or 'withdrawn'. */
export const setEnrollmentStatus = (id, status) => api.patch(`/enrollments/${id}`, { status }).then(toData);
