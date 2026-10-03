/**
 * Class-subjects: the subjects of a class and the teacher of each (the teacher assignment).
 * Teacher pages call these without a scope filter to get the visible set.
 *
 *   useClassSubjects(params, { enabled })  paginated list; pass limit: 100 when you need them all.
 *                                          params: classId, subjectId, teacherId ('me'), academicYear,
 *                                          page, limit, search, sortBy, sortOrder
 *   useClassSubject(id)                    one class-subject
 *   useCreateClassSubject() [form]         mutate({ classId, subjectId, teacherId })
 *   useReassignClassSubject() [form]       mutate({ id, teacherId }) change the teacher
 *   useDeleteClassSubject()                mutate(id); 409 when history exists
 *   useClassSubjectOptions(filters)        select options: [{ value, label: 'Class · Subject', item }];
 *                                          filters e.g. { classId } or { teacherId: 'me' }
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { createOptionsHook } from '../../hooks/createOptionsHook';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { dashboardKeys } from '../dashboard/keys';
import { scheduleKeys } from '../schedules/keys';
import { teacherKeys } from '../teachers/keys';
import {
  createClassSubject,
  deleteClassSubject,
  getClassSubject,
  listClassSubjects,
  reassignClassSubject,
} from './api';
import { classSubjectKeys } from './keys';

export function useClassSubjects(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: classSubjectKeys.list(params),
    queryFn: () => listClassSubjects(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useClassSubject(id) {
  return useQuery({
    queryKey: classSubjectKeys.detail(id),
    queryFn: () => getClassSubject(id),
    enabled: Boolean(id),
  });
}

/** An assignment change touches the class-subject lists, the timetables, the teachers and the dashboards. */
function useInvalidateAssignments() {
  const invalidate = useInvalidate();
  return () => invalidate(classSubjectKeys.all, scheduleKeys.all, teacherKeys.all, dashboardKeys.all);
}

export function useCreateClassSubject() {
  const invalidateAssignments = useInvalidateAssignments();
  const toast = useToast();
  return useMutation({
    mutationFn: createClassSubject,
    meta: { silent: true },
    onSuccess: (classSubject) => {
      invalidateAssignments();
      toast.success(`${classSubject.subjectName} added to ${classSubject.className}`);
    },
  });
}

export function useReassignClassSubject() {
  const invalidateAssignments = useInvalidateAssignments();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, teacherId }) => reassignClassSubject(id, teacherId),
    meta: { silent: true },
    onSuccess: (classSubject) => {
      invalidateAssignments();
      toast.success(`${classSubject.subjectName} is now taught by ${fullName(classSubject.teacher)}`);
    },
  });
}

export function useDeleteClassSubject() {
  const invalidateAssignments = useInvalidateAssignments();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteClassSubject,
    onSuccess: () => {
      invalidateAssignments();
      toast.success('Subject removed from the class');
    },
  });
}

export const useClassSubjectOptions = createOptionsHook({
  keys: classSubjectKeys,
  fetchList: listClassSubjects,
  toOption: (classSubject) => ({
    value: String(classSubject.id),
    label: `${classSubject.className} · ${classSubject.subjectName}`,
    item: classSubject,
  }),
});
