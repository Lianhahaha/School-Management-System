/**
 * Announcements.
 *
 *   useAnnouncements(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                          audience, classId, authorId ('me'), status (admin only)
 *   useCreateAnnouncement() [form]         mutate(body) with the createAnnouncementSchema output
 *   useUpdateAnnouncement() [form]         mutate({ id, body }) with the updateAnnouncementSchema output
 *   useDeleteAnnouncement()                mutate(id)
 *   useNewAnnouncements()                  how many announcements arrived since the last visit (sidebar count)
 *   useNewSinceLastVisit()                 for a list page: marks the visit, returns isNew(announcement)
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { dashboardKeys } from '../dashboard/keys';
import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from './api';
import { useAuth } from '../auth/hooks';
import { announcementKeys } from './keys';
import { isNewAnnouncement, markAnnouncementsSeen, useAnnouncementsSeenAt } from './seen';

/** The newest announcements checked for the sidebar count; more than this shows as "20". */
const NEW_COUNT_WINDOW = 20;

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

/**
 * Announcements published since this user last opened the announcements page (on this device),
 * not counting their own. Admins count the active ones only, as their page shows by default.
 */
export function useNewAnnouncements() {
  const { me, role } = useAuth();
  const seenAt = useAnnouncementsSeenAt(me.id);
  const params =
    role === 'admin' ? { status: 'active', limit: NEW_COUNT_WINDOW } : { limit: NEW_COUNT_WINDOW };
  const { data } = useAnnouncements(params);
  return (data?.items ?? []).filter((announcement) => isNewAnnouncement(announcement, seenAt, me.id)).length;
}

/**
 * For the announcements pages: remembers when the user last looked (before this visit), so the
 * cards published since then can carry a "New" tag, and records this visit on arrival and on leaving.
 *
 * @returns {(announcement: object) => boolean}
 */
export function useNewSinceLastVisit() {
  const { me } = useAuth();
  const seenAt = useAnnouncementsSeenAt(me.id);
  const [previousVisit] = useState(seenAt);

  useEffect(() => {
    markAnnouncementsSeen(me.id);
    return () => markAnnouncementsSeen(me.id);
  }, [me.id]);

  return (announcement) => isNewAnnouncement(announcement, previousVisit, me.id);
}
