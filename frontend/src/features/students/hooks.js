/**
 * Students. Creating a student is `useCreateUser` with role 'student' (features/users); enrolling
 * is features/enrollments.
 *
 *   useStudents(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                     classId, gradeLevel, gender, isActive, hasActiveEnrollment
 *   useStudent(id)                    one student ('me' for the signed-in student); includes currentEnrollment
 *   useUpdateStudent() [form]         mutate({ id, body }) admin only; body from changedFields(values, dirtyFields)
 *   useImportStudents() [form]        mutateAsync(body) checks (dryRun) or creates imported students; the
 *                                     import dialog shows every outcome itself
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { classKeys } from '../classes/keys';
import { dashboardKeys } from '../dashboard/keys';
import { enrollmentKeys } from '../enrollments/keys';
import { userKeys } from '../users/keys';
import { getStudent, importStudents, listStudents, updateStudent } from './api';
import { studentKeys } from './keys';

export function useStudents(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => listStudents(params),
    placeholderData: keepPreviousData,
    enabled,
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
      invalidate(studentKeys.all, userKeys.all);
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
      invalidate(studentKeys.all, userKeys.all, enrollmentKeys.all, classKeys.all, dashboardKeys.all);
    },
  });
}
