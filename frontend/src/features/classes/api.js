import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * params: page, limit, search (name), sortBy, sortOrder, academicYear, gradeLevel,
 * homeroomTeacherId ('me' allowed for a teacher). Teachers and students only see their visible classes.
 */
export const listClasses = (params) => api.get('/classes', { params }).then(toPage);

export const getClass = (id) => api.get(`/classes/${id}`).then(toData);

/** Admin only. Body: { name, gradeLevel, academicYear, homeroomTeacherId? }. */
export const createClass = (body) => api.post('/classes', body).then(toData);

/** Admin only. Any of name, gradeLevel, academicYear, homeroomTeacherId (null clears it). */
export const updateClass = (id, body) => api.patch(`/classes/${id}`, body).then(toData);

/** Admin only. 409 while other records (enrollments, subjects, ...) still reference the class. */
export const deleteClass = (id) => api.delete(`/classes/${id}`).then(toData);
