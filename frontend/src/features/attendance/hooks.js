/**
 * Attendance. The sheet (roster plus the marks of one date) is the unit of work for marking;
 * the flat records and the summary serve the student views and reports.
 *
 *   useAttendanceSheet({ classSubjectId, date }, { enabled })  roster with marks; fires only when both are set
 *   useSaveAttendanceSheet()      mutate({ classSubjectId, date, records }) resolves the saved sheet
 *   useAttendance(params, { enabled })       paginated records (no `search`); params: page, limit, sortBy,
 *                                            sortOrder, studentId ('me'), classSubjectId, classId, status, dateFrom, dateTo
 *   useAttendanceSummary(params, { enabled }) counts and rate; groupBy 'none' gives one object,
 *                                            'student' | 'classSubject' an array of them with a `label`
 *   useUpdateAttendance()         mutate({ id, body }) correct one record: { status?, remarks? }
 *   useDeleteAttendance()         mutate(id) admin only
 *
 * Every write refreshes all attendance queries and the dashboard.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/date';
import { dashboardKeys } from '../dashboard/keys';
import {
  deleteAttendance,
  getAttendanceSheet,
  getAttendanceSummary,
  listAttendance,
  saveAttendanceSheet,
  updateAttendance,
} from './api';
import { attendanceKeys } from './keys';

export function useAttendanceSheet({ classSubjectId, date }, { enabled = true } = {}) {
  return useQuery({
    queryKey: attendanceKeys.sheet({ classSubjectId, date }),
    queryFn: () => getAttendanceSheet({ classSubjectId, date }),
    enabled: enabled && Boolean(classSubjectId) && Boolean(date),
  });
}

export function useAttendance(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: () => listAttendance(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAttendanceSummary(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: attendanceKeys.summary(params),
    queryFn: () => getAttendanceSummary(params),
    enabled,
  });
}

export function useSaveAttendanceSheet() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: saveAttendanceSheet,
    onSuccess: (sheet) => {
      invalidate(attendanceKeys.all, dashboardKeys.all);
      const { className, subjectName } = sheet.classSubject;
      toast.success(`Attendance saved · ${className} · ${subjectName} · ${formatDate(sheet.date)}`);
    },
  });
}

export function useUpdateAttendance() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateAttendance(id, body),
    onSuccess: () => {
      invalidate(attendanceKeys.all, dashboardKeys.all);
      toast.success('Attendance record updated');
    },
  });
}

export function useDeleteAttendance() {
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => {
      invalidate(attendanceKeys.all, dashboardKeys.all);
      toast.success('Attendance record deleted');
    },
  });
}
