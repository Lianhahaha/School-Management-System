/**
 * The school calendar (holidays and school events).
 *
 *   useCalendarEvents(params, { enabled })  entries; params: page, limit, search, sortBy, sortOrder, type,
 *                                           dateFrom, dateTo (entries overlapping the range)
 *   useCreateCalendarEvent() [form]         mutate(body) with the calendarEventSchema output
 *   useUpdateCalendarEvent() [form]         mutate({ id, body })
 *   useDeleteCalendarEvent()                mutate(id)
 *   useWeekEvents()                         this week's entries by ISO weekday (the timetables' day notes)
 *
 * Writes refresh the calendar, the dashboards (upcoming entries) and the attendance sheets (a holiday
 * blocks marking). Mutations tagged [form] are silent: their form shows every error itself.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { PAGINATION } from '../../constants/shared';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { addDaysYmd, isoWeekdayOf, mondayOf, todayYmd } from '../../utils/date';
import { attendanceKeys } from '../attendance/keys';
import { dashboardKeys } from '../dashboard/keys';
import { createCalendarEvent, deleteCalendarEvent, listCalendarEvents, updateCalendarEvent } from './api';
import { calendarKeys } from './keys';

export function useCalendarEvents(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: calendarKeys.list(params),
    queryFn: () => listCalendarEvents(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidateCalendar() {
  const invalidate = useInvalidate();
  return () => invalidate(calendarKeys.all, dashboardKeys.all, attendanceKeys.all);
}

export function useCreateCalendarEvent() {
  const invalidateCalendar = useInvalidateCalendar();
  const toast = useToast();
  return useMutation({
    mutationFn: createCalendarEvent,
    meta: { silent: true },
    onSuccess: (event) => {
      invalidateCalendar();
      toast.success(`${event.title} added to the calendar`);
    },
  });
}

export function useUpdateCalendarEvent() {
  const invalidateCalendar = useInvalidateCalendar();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateCalendarEvent(id, body),
    meta: { silent: true },
    onSuccess: (event) => {
      invalidateCalendar();
      toast.success(`${event.title} updated`);
    },
  });
}

export function useDeleteCalendarEvent() {
  const invalidateCalendar = useInvalidateCalendar();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: () => {
      invalidateCalendar();
      toast.success('Entry removed from the calendar');
    },
  });
}

/**
 * This week's calendar entries (Monday to Sunday) as a Map of ISO weekday -> entries running that day,
 * for the timetables. Empty while loading or when the request fails: the timetable stays usable.
 */
export function useWeekEvents() {
  const monday = mondayOf(todayYmd());
  const sunday = addDaysYmd(monday, 6);
  const { data } = useCalendarEvents({ dateFrom: monday, dateTo: sunday, limit: PAGINATION.MAX_LIMIT });

  const byDay = new Map();
  for (const event of data?.items ?? []) {
    for (let day = monday; day <= sunday; day = addDaysYmd(day, 1)) {
      if (event.startsOn > day || event.endsOn < day) continue;
      const weekday = isoWeekdayOf(day);
      byDay.set(weekday, [...(byDay.get(weekday) ?? []), event]);
    }
  }
  return byDay;
}
