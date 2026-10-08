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
 *   useClassSubjectSelection({ withDate }) the lesson a page works on, kept in the URL (with
 *                                          <ClassSubjectSelectorBar>)
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { DATE_REGEX } from '../../constants/shared';
import { createOptionsHook } from '../../hooks/createOptionsHook';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { todayYmd } from '../../utils/date';
import { fullName } from '../../utils/names';
import { useAuth } from '../auth/hooks';
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
    meta: { live: false }, // a lesson's header (class, subject, teacher) rarely changes
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

/**
 * The class (admin only), class-subject and optional date a page works on, kept in the URL
 * (`classId`, `classSubjectId`, `date`) so a link from the dashboard can preselect a lesson.
 * Used by the attendance and grades pages together with <ClassSubjectSelectorBar>.
 *
 *   const selection = useClassSubjectSelection({ withDate: true });
 *   selection.classSubjectId, selection.date, selection.isOwner ...
 *
 * `selected` is the class-subject query (one lesson: class, subject, teacherId). `isOwner` is true for
 * an admin and for the teacher the class-subject is assigned to; a teacher who only sees the class as
 * its homeroom teacher gets read-only access.
 *
 * @param {{ withDate?: boolean }} [options]
 */
export function useClassSubjectSelection({ withDate = false } = {}) {
  const { me, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const classSubjectId = searchParams.get('classSubjectId') ?? '';
  const rawDate = searchParams.get('date') ?? '';
  const date = withDate ? (DATE_REGEX.test(rawDate) ? rawDate : todayYmd()) : '';

  const selected = useClassSubject(classSubjectId);
  // An admin who arrived with only a class-subject (a link) still sees the right class selected.
  const classId = searchParams.get('classId') || (selected.data ? String(selected.data.classId) : '');

  const update = (patch) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        next.delete('page');
        return next;
      },
      { replace: true },
    );

  return {
    role,
    classId,
    classSubjectId,
    date,
    selected,
    isOwner: role === 'admin' || (Boolean(selected.data) && selected.data.teacherId === me.teacherId),
    setClassId: (value) => update({ classId: value, classSubjectId: '' }),
    setClassSubjectId: (value) => update({ classSubjectId: value }),
    setDate: (value) => update({ date: value }),
  };
}
