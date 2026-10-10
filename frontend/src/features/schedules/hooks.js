/**
 * Schedules: the weekly timetable slots of class-subjects. Render them with
 * `<WeeklyTimetable slots={data.items} />` (components/WeeklyTimetable.jsx).
 *
 *   useSchedules(params, { enabled })  paginated list; pass limit: 100 for a whole timetable.
 *                                      params: classId, teacherId ('me'), classSubjectId, dayOfWeek, room,
 *                                      academicYear, page, limit, search, sortBy, sortOrder
 *   useCreateSchedule() [form]         mutate(body) with the createScheduleSchema output
 *   useUpdateSchedule() [form]         mutate({ id, body }) with the updateScheduleSchema output
 *   useDeleteSchedule()                mutate(id)
 *
 * A clash (class, teacher or room already busy) is a 409 SCHEDULE_CONFLICT whose `error.details.conflicts`
 * the slot modal lists; it never toasts.
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { attendanceKeys } from '../attendance/keys';
import { dashboardKeys } from '../dashboard/keys';
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from './api';
import { scheduleKeys } from './keys';

export function useSchedules(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: scheduleKeys.list(params),
    queryFn: () => listSchedules(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateSchedule() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: createSchedule,
    meta: { silent: true },
    onSuccess: () => {
      invalidate(scheduleKeys.all, dashboardKeys.all, attendanceKeys.all);
      toast.success('Period added to the schedule');
    },
  });
}

export function useUpdateSchedule() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ id: number, body: object }} */ { id, body }) => updateSchedule(id, body),
    meta: { silent: true },
    onSuccess: () => {
      invalidate(scheduleKeys.all, dashboardKeys.all, attendanceKeys.all);
      toast.success('Period updated');
    },
  });
}

export function useDeleteSchedule() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      invalidate(scheduleKeys.all, dashboardKeys.all, attendanceKeys.all);
      toast.success('Period removed');
    },
  });
}
