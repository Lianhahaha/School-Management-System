import { createKeys } from '../../lib/queryKeys';

const base = createKeys('notifications');

/** Query keys for notifications: GET /notifications (list) and GET /notifications/unread-count. */
export const notificationKeys = {
  ...base,
  unreadCount: () => [...base.all, 'unread-count'],
};
