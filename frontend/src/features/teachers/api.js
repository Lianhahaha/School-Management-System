import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/** Admin only. params: page, limit, search, sortBy, sortOrder, department, isActive. */
export const listTeachers = (params) => api.get('/teachers', { params }).then(toPage);

/** Admin, or a teacher reading their own record: `id` may be 'me'. */
export const getTeacher = (id) => api.get(`/teachers/${id}`).then(toData);

/** Admin only. Updates the account and the teacher profile in one call; there is no delete. */
export const updateTeacher = (id, body) => api.patch(`/teachers/${id}`, body).then(toData);
