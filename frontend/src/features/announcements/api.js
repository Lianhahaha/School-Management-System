import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Announcements visible to the caller (students: active ones for their audience and class).
 * params: page, limit, search (title, body), sortBy (publishedAt, title, createdAt), sortOrder, audience,
 * classId, authorId ('me' allowed), status ('active' | 'scheduled' | 'expired' | 'all', admin only).
 */
export const listAnnouncements = (params) => api.get('/announcements', { params }).then(toPage);

export const getAnnouncement = (id) => api.get(`/announcements/${id}`).then(toData);

/**
 * Admin, or a teacher for a visible class (classId is then required).
 * Body: { title, body, audience, classId?, publishedAt?, expiresAt? } with ISO-8601 date-times.
 */
export const createAnnouncement = (body) => api.post('/announcements', body).then(toData);

/** Admin on any, a teacher on their own. Any of title, body, audience, classId, publishedAt, expiresAt. */
export const updateAnnouncement = (id, body) => api.patch(`/announcements/${id}`, body).then(toData);

/** Admin on any, a teacher on their own. A hard delete. */
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`).then(toData);
