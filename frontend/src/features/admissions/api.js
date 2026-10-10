import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/*
 * Applications are read with the students: GET /students?admissionStatus=pending, and `student.admission`.
 * There is no admit call: enrolling the student in a class (features/enrollments) admits them.
 */

/** Admin only. Body: { birthCertificateReceived?, reportCardReceived? }. Resolves the student. */
export const updateAdmission = (studentId, body) => api.patch(`/admissions/${studentId}`, body).then(toData);

/** Admin only. Declines a pending application (409 `not_pending` otherwise). Resolves the student. */
export const declineAdmission = (studentId, reason) =>
  api.post(`/admissions/${studentId}/decline`, { reason }).then(toData);
