/**
 * Admissions: the applications self-registered students send. They are listed with useStudents (the
 * `admissionStatus` filter) and read from `student.admission`; admitting is enrolling (useEnrollStudent).
 *
 *   PENDING_APPLICATIONS_PARAMS     the filter behind the Admissions nav badge
 *   useUpdateAdmission()            mutate({ studentId, body }) ticks documents off the checklist; it stays
 *                                   pending until the students are reloaded, so a ticked box never flicks back
 *   useDeclineAdmission() [form]    mutate({ studentId, reason })
 *
 * Writes refresh the students (lists, detail, the nav badge) and the dashboard; a decline also refreshes the
 * bell, since it marks the admins' sign-up notifications read.
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { dashboardKeys } from '../dashboard/keys';
import { notificationKeys } from '../notifications/keys';
import { studentKeys } from '../students/keys';
import { declineAdmission, updateAdmission } from './api';

/** Pending applications; `limit: 1` because only `meta.total` is read. */
export const PENDING_APPLICATIONS_PARAMS = Object.freeze({ admissionStatus: 'pending', limit: 1 });

export function useUpdateAdmission() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (/** @type {{ studentId: number, body: object }} */ { studentId, body }) =>
      updateAdmission(studentId, body),
    onSuccess: () => {
      invalidate(dashboardKeys.all);
      // Returned, so the mutation stays pending (and the checkbox shows its new value) until the rows reload.
      return queryClient.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

export function useDeclineAdmission() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ studentId: number, reason: string }} */ { studentId, reason }) =>
      declineAdmission(studentId, reason),
    meta: { silent: true },
    onSuccess: (student) => {
      invalidate(studentKeys.all, dashboardKeys.all, notificationKeys.all);
      toast.success(`Application of ${fullName(student)} declined`);
    },
  });
}
