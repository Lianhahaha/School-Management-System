/**
 * Students. Creating a student is `useCreateUser` with role 'student' (features/users); enrolling
 * is features/enrollments.
 *
 *   useStudents(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                     classId, gradeLevel, gender, isActive, hasActiveEnrollment
 *   useClassRoster(classId)           every student currently in the class, as an array (all pages)
 *   useStudent(id)                    one student ('me' for the signed-in student); includes currentEnrollment
 *   useUpdateStudent() [form]         mutate({ id, body }) admin only; body from changedFields(values, dirtyFields)
 *   useImportStudents() [form]        mutateAsync(body) checks (dryRun) or creates imported students; the
 *                                     import dialog shows every outcome itself. Imported students can be put in
 *                                     a class, so it also refreshes the attendance sheets and grade rosters
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fetchAllPages } from '../../lib/csv';
import { fullName } from '../../utils/names';
import { attendanceKeys } from '../attendance/keys';
import { classKeys } from '../classes/keys';
import { dashboardKeys } from '../dashboard/keys';
import { enrollmentKeys } from '../enrollments/keys';
import { gradeKeys } from '../grades/keys';
import { userKeys } from '../users/keys';
import { getStudent, importStudents, listStudents, updateStudent } from './api';
import { studentKeys } from './keys';

/**
 * Active students without a class: the filter of the dashboard's "Unenrolled students" tile, the nav badge
 * and the Students page note. `limit: 1` because only `meta.total` is read.
 */
export const UNENROLLED_STUDENTS_PARAMS = Object.freeze({
  hasActiveEnrollment: 'false',
  isActive: 'true',
  limit: 1,
});

export function useStudents(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => listStudents(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every student currently in the class (all pages, by last name), e.g. for the end of a school year. */
export function useClassRoster(classId, { enabled = true } = {}) {
  const params = { classId, sortBy: 'lastName', sortOrder: 'asc' };
  return useQuery({
    queryKey: [...studentKeys.lists(), 'all', params],
    queryFn: () => fetchAllPages(listStudents, params),
    enabled,
    // Not refreshed in the background: the list an admin is ticking must not change under their hands.
    meta: { live: false },
  });
}

export function useStudent(id) {
  return useQuery({ queryKey: studentKeys.detail(id), queryFn: () => getStudent(id), enabled: Boolean(id) });
}

export function useUpdateStudent() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateStudent(id, body),
    meta: { silent: true },
    onSuccess: (student) => {
      // The name shows on rosters, enrollments and dashboards too.
      invalidate(
        studentKeys.all,
        userKeys.all,
        enrollmentKeys.all,
        attendanceKeys.all,
        gradeKeys.all,
        dashboardKeys.all,
      );
      toast.success(`${fullName(student)} updated`);
    },
  });
}

export function useImportStudents() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: importStudents,
    meta: { silent: true },
    onSuccess: (report) => {
      if (report.dryRun) return;
      // A row with a class enrolls the student: the sheets and rosters of that class list them.
      invalidate(
        studentKeys.all,
        userKeys.all,
        enrollmentKeys.all,
        classKeys.all,
        attendanceKeys.all,
        gradeKeys.all,
        dashboardKeys.all,
      );
    },
  });
}
