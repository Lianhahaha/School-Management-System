/**
 * Announcements.
 *
 *   useAnnouncements(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                          audience, classId, authorId ('me'), status (admin only)
 *   useCreateAnnouncement() [form]         mutate(body) with the createAnnouncementSchema output
 *   useUpdateAnnouncement() [form]         mutate({ id, body }) with the updateAnnouncementSchema output
 *   useDeleteAnnouncement()                mutate(id)
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { dashboardKeys } from '../dashboard/keys';
import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from './api';
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
