import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/** The caller's notifications, newest first. params: page, limit, sortBy (createdAt), sortOrder, unread. */
export const listNotifications = (params) => api.get('/notifications', { params }).then(toPage);

/** `{ count }` of the caller's unread notifications. */
export const getUnreadCount = () => api.get('/notifications/unread-count').then(toData);

/** Marks the caller's notifications read: `ids`, or all of them when omitted. Resolves `{ updated }`. */
export const markNotificationsRead = (ids) =>
  api.post('/notifications/read', ids ? { ids } : {}).then(toData);
