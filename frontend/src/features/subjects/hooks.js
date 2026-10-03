/**
 * Subjects (the catalogue; a subject taught in a class is a class-subject, features/classSubjects).
 *
 *   useSubjects(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder, isActive
 *   useSubject(id)                    one subject
 *   useCreateSubject() [form]         mutate(body) with the createSubjectSchema output
 *   useUpdateSubject() [form]         mutate({ id, body }) with the updateSubjectSchema output
 *   useSetSubjectActive()             mutate({ id, isActive }) retire or reactivate (a row action: errors toast)
 *   useDeleteSubject()                mutate(id); 409 when in use
 *   useSubjectOptions(filters)        select options of active subjects: [{ value, label: 'CODE · Name', item }]
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { createOptionsHook } from '../../hooks/createOptionsHook';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { classSubjectKeys } from '../classSubjects/keys';
import { createSubject, deleteSubject, getSubject, listSubjects, updateSubject } from './api';
import { subjectKeys } from './keys';

export function useSubjects(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: subjectKeys.list(params),
    queryFn: () => listSubjects(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSubject(id) {
  return useQuery({ queryKey: subjectKeys.detail(id), queryFn: () => getSubject(id), enabled: Boolean(id) });
}

export function useCreateSubject() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: createSubject,
    meta: { silent: true },
    onSuccess: (subject) => {
      invalidate(subjectKeys.all, classSubjectKeys.all);
      toast.success(`${subject.name} created`);
    },
  });
}

export function useUpdateSubject() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateSubject(id, body),
    meta: { silent: true },
    onSuccess: (subject) => {
      invalidate(subjectKeys.all, classSubjectKeys.all);
      toast.success(`${subject.name} updated`);
    },
  });
}

export function useSetSubjectActive() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, isActive }) => updateSubject(id, { isActive }),
    onSuccess: (subject) => {
      invalidate(subjectKeys.all, classSubjectKeys.all);
      toast.success(`${subject.name} ${subject.isActive ? 'reactivated' : 'retired'}`);
    },
  });
}

export function useDeleteSubject() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      invalidate(subjectKeys.all, classSubjectKeys.all);
      toast.success('Subject deleted');
    },
  });
}

export const useSubjectOptions = createOptionsHook({
  keys: subjectKeys,
  fetchList: listSubjects,
  baseParams: { isActive: 'true', sortBy: 'code' },
  toOption: (subject) => ({
    value: String(subject.id),
    label: `${subject.code} · ${subject.name}`,
    item: subject,
  }),
});
