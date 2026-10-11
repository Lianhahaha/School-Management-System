import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/*
 * Applications are read with the students: GET /students?admissionStatus=pending, and `student.admission`.
 * There is no admit or decline call: the student picks a class themselves (features/enrollments, standing
 * `new`), or the office enrolls them, and enrolling admits them.
 */

/** The office only. Body: { birthCertificateReceived?, reportCardReceived? }. Resolves the student. */
export const updateAdmission = (studentId, body) => api.patch(`/admissions/${studentId}`, body).then(toData);
