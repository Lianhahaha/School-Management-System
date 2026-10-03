import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/** params: page, limit, search (code, name), sortBy, sortOrder, isActive. */
export const listSubjects = (params) => api.get('/subjects', { params }).then(toPage);

export const getSubject = (id) => api.get(`/subjects/${id}`).then(toData);

/** Admin only. Body: { code, name, description? }. 409 when the code exists. */
export const createSubject = (body) => api.post('/subjects', body).then(toData);

/** Admin only. Any of code, name, description, isActive (retire / reactivate). */
export const updateSubject = (id, body) => api.patch(`/subjects/${id}`, body).then(toData);

/** Admin only. 409 when the subject is used by a class; retire it instead. */
export const deleteSubject = (id) => api.delete(`/subjects/${id}`).then(toData);
