/**
 * Classes (a school year's group of students, for example "Grade 7 - A").
 *
 *   useClasses(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                    academicYear, gradeLevel, homeroomTeacherId ('me' for a teacher)
 *   useClass(id)                     one class, with homeroomTeacher and studentCount
 *   useCreateClass() [form]          mutate(body) with the createClassSchema output
 *   useUpdateClass() [form]          mutate({ id, body }) with the updateClassSchema output; also refreshes
 *                                    the class-subject, student, enrollment, timetable, attendance, grade
 *                                    and announcement rows that show the class name
 *   useDeleteClass()                 mutate(id); 409 when referenced
 *   useClassOptions(filters)         select options: [{ value, label: 'Name · 2026-2027 · 30 students', item }];
 *                                    filters e.g. { academicYear, search }
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { createOptionsHook } from '../../hooks/createOptionsHook';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { countOf } from '../../utils/format';
import { announcementKeys } from '../announcements/keys';
import { attendanceKeys } from '../attendance/keys';
import { classSubjectKeys } from '../classSubjects/keys';
import { dashboardKeys } from '../dashboard/keys';
import { enrollmentKeys } from '../enrollments/keys';
import { gradeKeys } from '../grades/keys';
import { scheduleKeys } from '../schedules/keys';
import { studentKeys } from '../students/keys';
import { createClass, deleteClass, getClass, listClasses, updateClass } from './api';
import { classKeys } from './keys';

export function useClasses(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: classKeys.list(params),
    queryFn: () => listClasses(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useClass(id) {
  return useQuery({ queryKey: classKeys.detail(id), queryFn: () => getClass(id), enabled: Boolean(id) });
}

export function useCreateClass() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: createClass,
    meta: { silent: true },
    onSuccess: (createdClass) => {
      invalidate(classKeys.all, dashboardKeys.all);
      toast.success(`${createdClass.name} created`);
    },
  });
}

export function useUpdateClass() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ id: number, body: object }} */ { id, body }) => updateClass(id, body),
    meta: { silent: true },
    onSuccess: (updatedClass) => {
      // The attendance sheets and grade rosters show the class name too, and the live refresh skips them.
      invalidate(
        classKeys.all,
        classSubjectKeys.all,
        studentKeys.all,
        enrollmentKeys.all,
        scheduleKeys.all,
        attendanceKeys.all,
        gradeKeys.all,
        announcementKeys.all,
        dashboardKeys.all,
      );
      toast.success(`${updatedClass.name} updated`);
    },
  });
}

export function useDeleteClass() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      invalidate(classKeys.all, dashboardKeys.all);
      toast.success('Class deleted');
    },
  });
}

export const useClassOptions = createOptionsHook({
  keys: classKeys,
  fetchList: listClasses,
  toOption: (schoolClass) => ({
    value: String(schoolClass.id),
    label: `${schoolClass.name} · ${schoolClass.academicYear} · ${countOf(schoolClass.studentCount, 'student')}`,
    item: schoolClass,
  }),
});
