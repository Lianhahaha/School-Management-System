/**
 * Accounts (admin only). Mutations raise their own success toast; errors follow the global policy.
 *
 *   useUsers(params, { enabled })   paginated list; params from useListParams().apiParams
 *   useUser(id)                     one account
 *   useCreateUser() [form]          mutate(body) with the createUserSchema output; resolves the new user
 *   useUpdateUser() [form]          mutate({ id, body }) name and phone
 *   useSetUserStatus()              mutate({ id, isActive }) activate or deactivate (409 teacher_has_assignments)
 *
 * Creating a user also refreshes the student or teacher lists (by role) and the dashboard.
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { dashboardKeys } from '../dashboard/keys';
import { studentKeys } from '../students/keys';
import { teacherKeys } from '../teachers/keys';
import { createUser, getUser, listUsers, setUserStatus, updateUser } from './api';
import { userKeys } from './keys';

const PROFILE_KEYS = { student: studentKeys.all, teacher: teacherKeys.all };

export function useUsers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUser(id) {
  return useQuery({ queryKey: userKeys.detail(id), queryFn: () => getUser(id), enabled: Boolean(id) });
}

/** Refreshes the user lists, the student or teacher lists of that role, and the dashboard. */
function useInvalidateUser() {
  const invalidate = useInvalidate();
  return (user) => invalidate(userKeys.all, dashboardKeys.all, ...(PROFILE_KEYS[user.role] ?? []));
}

export function useCreateUser() {
  const invalidateUser = useInvalidateUser();
  const toast = useToast();
  return useMutation({
    mutationFn: createUser,
    meta: { silent: true },
    onSuccess: (user) => {
      invalidateUser(user);
      toast.success(`${fullName(user)} created`);
    },
  });
}

export function useUpdateUser() {
  const invalidateUser = useInvalidateUser();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    meta: { silent: true },
    onSuccess: (user) => {
      invalidateUser(user);
      toast.success(`${fullName(user)} updated`);
    },
  });
}

export function useSetUserStatus() {
  const invalidateUser = useInvalidateUser();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, isActive }) => setUserStatus(id, isActive),
    onSuccess: (user) => {
      invalidateUser(user);
      toast.success(`${fullName(user)} ${user.isActive ? 'activated' : 'deactivated'}`);
    },
  });
}
