/**
 * The signed-in user's notifications (the bell in the top bar).
 *
 *   useUnreadCount()                       number of unread notifications; the live refresh keeps it current
 *   useNotifications(params, { enabled })  newest first; params: page, limit, unread
 *   useMarkNotificationsRead()             mutate(ids) marks those read, mutate() marks all of them
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { getUnreadCount, listNotifications, markNotificationsRead } from './api';
import { notificationKeys } from './keys';

export function useUnreadCount() {
  const { data } = useQuery({ queryKey: notificationKeys.unreadCount(), queryFn: getUnreadCount });
  return data?.count ?? 0;
}

export function useNotifications(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    enabled,
  });
}

export function useMarkNotificationsRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ids) => markNotificationsRead(ids),
    onSuccess: () => invalidate(notificationKeys.all),
  });
}
