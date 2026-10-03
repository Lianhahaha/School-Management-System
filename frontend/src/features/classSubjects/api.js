import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * A class-subject is a subject taught in one class by one teacher (the teacher assignment).
 * params: page, limit, search, sortBy (className, subjectName, teacherLastName, createdAt), sortOrder,
 * classId, subjectId, teacherId ('me' allowed), academicYear. Without a scope filter the backend
 * returns the caller's visible set: taught plus homeroom for a teacher, the own class for a student.
 */
export const listClassSubjects = (params) => api.get('/class-subjects', { params }).then(toPage);

export const getClassSubject = (id) => api.get(`/class-subjects/${id}`).then(toData);

/** Admin only. Body: { classId, subjectId, teacherId }. 409 when the class already has that subject. */
export const createClassSubject = (body) => api.post('/class-subjects', body).then(toData);

/** Admin only. Only the teacher can change: history stays with the class-subject. */
export const reassignClassSubject = (id, teacherId) =>
  api.patch(`/class-subjects/${id}`, { teacherId }).then(toData);

/** Admin only. 409 when attendance, assessments or schedule slots exist for it. */
export const deleteClassSubject = (id) => api.delete(`/class-subjects/${id}`).then(toData);
