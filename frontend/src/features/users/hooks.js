/**
 * Accounts (admin only). Mutations raise their own success toast; errors follow the global policy.
 *
 *   useUsers(params, { enabled })   paginated list; params from useListParams().apiParams
 *   useCreateUser() [form]          mutate(body) with the createUserSchema output; resolves the new user
 *   useUpdateUser() [form]          mutate({ id, body }) name and phone
 *   useSetUserStatus()              mutate({ id, isActive }) activate or deactivate (409 teacher_has_assignments)
 *   useDeleteUser() [form]          mutate(user) deletes an account that has no school records yet
 *
 * An account shows up in the student and teacher lists, classes (homeroom teacher, student counts),
 * class-subjects and timetables (teacher name), enrollments and the dashboard, so every write
 * refreshes all of them. Editing your own account also refreshes the session (`me`).
 *
 * Mutations tagged [form] are silent (meta.silent): the form or dialog that sends them shows every
 * error itself. Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { useAuth } from '../auth/hooks';
import { classKeys } from '../classes/keys';
import { classSubjectKeys } from '../classSubjects/keys';
import { dashboardKeys } from '../dashboard/keys';
import { enrollmentKeys } from '../enrollments/keys';
import { scheduleKeys } from '../schedules/keys';
import { studentKeys } from '../students/keys';
import { teacherKeys } from '../teachers/keys';
import { createUser, deleteUser, listUsers, setUserStatus, updateUser } from './api';
import { userKeys } from './keys';

const ACCOUNT_SCOPES = [
  userKeys.all,
  studentKeys.all,
  teacherKeys.all,
  classKeys.all,
  classSubjectKeys.all,
  scheduleKeys.all,
  enrollmentKeys.all,
  dashboardKeys.all,
];

export function useUsers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidateAccounts() {
  const invalidate = useInvalidate();
  return () => invalidate(...ACCOUNT_SCOPES);
}

export function useCreateUser() {
  const invalidateAccounts = useInvalidateAccounts();
  const toast = useToast();
  return useMutation({
    mutationFn: createUser,
    meta: { silent: true },
    onSuccess: (user) => {
      invalidateAccounts();
      toast.success(`${fullName(user)} created`);
    },
  });
}

export function useUpdateUser() {
  const invalidateAccounts = useInvalidateAccounts();
  const { me, refreshMe } = useAuth();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    meta: { silent: true },
    onSuccess: (user) => {
      invalidateAccounts();
      if (user.id === me?.id) refreshMe();
      toast.success(`${fullName(user)} updated`);
    },
  });
}

export function useSetUserStatus() {
  const invalidateAccounts = useInvalidateAccounts();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, isActive }) => setUserStatus(id, isActive),
    onSuccess: (user) => {
      toast.success(`${fullName(user)} ${user.isActive ? 'reactivated' : 'deactivated'}`);
    },
    // Also after a 503: the school side may be saved while the sign-in step failed, so show what is stored.
    onSettled: () => invalidateAccounts(),
  });
}

export function useDeleteUser() {
  const invalidateAccounts = useInvalidateAccounts();
  const toast = useToast();
  return useMutation({
    mutationFn: (user) => deleteUser(user.id),
    meta: { silent: true },
    onSuccess: (_, user) => {
      invalidateAccounts();
      toast.success(`${fullName(user)} deleted`);
    },
  });
}
