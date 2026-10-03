import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/** Accounts of every role (admin only). params: page, limit, search, sortBy, sortOrder, role, isActive. */
export const listUsers = (params) => api.get('/users', { params }).then(toPage);

export const getUser = (id) => api.get(`/users/${id}`).then(toData);

/** Creates the Firebase user, the account and (students, teachers) the profile in one call. */
export const createUser = (body) => api.post('/users', body).then(toData);

/** Name and phone only; email and role are immutable. */
export const updateUser = (id, body) => api.patch(`/users/${id}`, body).then(toData);

export const setUserStatus = (id, isActive) => api.patch(`/users/${id}/status`, { isActive }).then(toData);
