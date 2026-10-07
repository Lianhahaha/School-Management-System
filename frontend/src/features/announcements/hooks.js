/**
 * Announcements.
 *
 *   useAnnouncements(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                          audience, classId, authorId ('me'), status (admin only), unread
 *   useCreateAnnouncement() [form]         mutate(body) with the createAnnouncementSchema output
 *   useUpdateAnnouncement() [form]         mutate({ id, body }) with the updateAnnouncementSchema output
 *   useDeleteAnnouncement()                mutate(id)
 *   useMarkAnnouncementsRead()             mutate([id]) marks that one read, mutate() marks all of them
 *   useNewAnnouncements()                  how many announcements are not marked read yet (sidebar count)
 *   useIsNewAnnouncement()                 returns isNew(announcement) for the "New" tag
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { dashboardKeys } from '../dashboard/keys';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  markAnnouncementsRead,
  updateAnnouncement,
} from './api';
import { useAuth } from '../auth/hooks';
import { announcementKeys } from './keys';

export function useAnnouncements(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: announcementKeys.list(params),
    queryFn: () => listAnnouncements(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: createAnnouncement,
    meta: { silent: true },
    onSuccess: (announcement) => {
      invalidate(announcementKeys.all, dashboardKeys.all);
      toast.success(`${announcement.title} published`);
    },
  });
}

export function useUpdateAnnouncement() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateAnnouncement(id, body),
    meta: { silent: true },
    onSuccess: (announcement) => {
      invalidate(announcementKeys.all, dashboardKeys.all);
      toast.success(`${announcement.title} updated`);
    },
  });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      invalidate(announcementKeys.all, dashboardKeys.all);
      toast.success('Announcement deleted');
    },
  });
}

export function useMarkAnnouncementsRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: markAnnouncementsRead,
    onSuccess: () => invalidate(announcementKeys.all),
  });
}

const UNREAD_COUNT_PARAMS = { unread: true, limit: 1 };

/** Active announcements by someone else that this user has not marked read. */
export function useNewAnnouncements() {
  const { data } = useAnnouncements(UNREAD_COUNT_PARAMS);
  return data?.meta.total ?? 0;
}

/** @returns {(announcement: object) => boolean} not marked read, active, and written by someone else */
export function useIsNewAnnouncement() {
  const { me } = useAuth();
  return (announcement) =>
    !announcement.isRead && announcement.status === 'active' && announcement.author?.id !== me.id;
}
