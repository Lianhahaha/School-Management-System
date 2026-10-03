/**
 * Students. Creating a student is `useCreateUser` with role 'student' (features/users); enrolling
 * is features/enrollments.
 *
 *   useStudents(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                     classId, gradeLevel, gender, isActive, hasActiveEnrollment
 *   useStudent(id)                    one student ('me' for the signed-in student); includes currentEnrollment
 *   useUpdateStudent() [form]         mutate({ id, body }) admin only; body from changedFields(values, dirtyFields)
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { userKeys } from '../users/keys';
import { getStudent, listStudents, updateStudent } from './api';
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
