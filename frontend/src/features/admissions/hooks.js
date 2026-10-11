/**
 * Admissions: the applications self-registered students send. They are listed with useStudents (the
 * `admissionStatus` filter) and read from `student.admission`. Nobody approves or declines one: the student
 * picks a class themselves, or the office enrolls them (useEnrollStudent), and enrolling admits them.
 *
 *   PENDING_APPLICATIONS_PARAMS     the filter behind the Admissions nav badge
 *   useUpdateAdmission()            mutate({ studentId, body }) ticks documents off the checklist; it stays
 *                                   pending until the students are reloaded, so a ticked box never flicks back
 *
 * Writes refresh the students (lists, detail, the nav badge) and the dashboard.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { dashboardKeys } from '../dashboard/keys';
import { studentKeys } from '../students/keys';
import { updateAdmission } from './api';

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
