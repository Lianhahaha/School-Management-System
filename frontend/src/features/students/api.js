import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * The office and teachers (teachers see their visible classes). params: page, limit, search, sortBy,
 * sortOrder, classId, gradeLevel, gender, isActive, hasActiveEnrollment (false includes pending applicants and
 * leaves out applications declined in the past), academicYear (students whose active enrollment is in a class
 * of that school year), admissionStatus, enrolledFrom and enrolledTo (both, with
 * classId: the class's students on any day of that range, those who have left it since included, instead of
 * its students now).
 */
export const listStudents = (params) => api.get('/students', { params }).then(toPage);

/** `id` may be 'me' for a student reading their own record. */
export const getStudent = (id) => api.get(`/students/${id}`).then(toData);

/** The office only. Updates the account and the student profile in one call; there is no delete. */
export const updateStudent = (id, body) => api.patch(`/students/${id}`, body).then(toData);
