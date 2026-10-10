/**
 * Teachers. Creating a teacher is `useCreateUser` with role 'teacher' (features/users).
 * A teacher's assignments are `useClassSubjects({ teacherId })` and their homeroom classes
 * `useClasses({ homeroomTeacherId })`; their timetable is `useSchedules({ teacherId })`.
 *
 *   useTeachers(params, { enabled })  paginated list (admin); params: page, limit, search, sortBy,
 *                                     sortOrder, department, isActive
 *   useTeacher(id)                    one teacher ('me' allowed)
 *   useUpdateTeacher() [form]         mutate({ id, body }) admin only; body from changedFields(values, dirtyFields);
 *                                     also refreshes the class-subject, class and timetable rows that show the name,
 *                                     the attendance sheets and grade rosters (who marked or graded) and the
 *                                     announcements (author)
 *   useTeacherOptions(filters)        select options of active teachers: [{ value, label, item }]; filters e.g. { search }
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { createOptionsHook } from '../../hooks/createOptionsHook';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { announcementKeys } from '../announcements/keys';
import { attendanceKeys } from '../attendance/keys';
import { classKeys } from '../classes/keys';
import { classSubjectKeys } from '../classSubjects/keys';
import { dashboardKeys } from '../dashboard/keys';
import { gradeKeys } from '../grades/keys';
import { scheduleKeys } from '../schedules/keys';
import { userKeys } from '../users/keys';
import { getTeacher, listTeachers, updateTeacher } from './api';
import { teacherKeys } from './keys';

export function useTeachers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: teacherKeys.list(params),
    queryFn: () => listTeachers(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTeacher(id) {
  return useQuery({ queryKey: teacherKeys.detail(id), queryFn: () => getTeacher(id), enabled: Boolean(id) });
}

export function useUpdateTeacher() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateTeacher(id, body),
    meta: { silent: true },
    onSuccess: (teacher) => {
      // The sheets name who marked or graded, and the live refresh skips them.
      invalidate(
        teacherKeys.all,
        userKeys.all,
        classSubjectKeys.all,
        classKeys.all,
        scheduleKeys.all,
        attendanceKeys.all,
        gradeKeys.all,
        announcementKeys.all,
        dashboardKeys.all,
      );
      toast.success(`${fullName(teacher)} updated`);
    },
  });
}

export const useTeacherOptions = createOptionsHook({
  keys: teacherKeys,
  fetchList: listTeachers,
  baseParams: { isActive: 'true' },
  toOption: (teacher) => ({ value: String(teacher.id), label: fullName(teacher), item: teacher }),
});
