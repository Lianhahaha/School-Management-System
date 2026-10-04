/**
 * Enrollments: which class a student is in. Only one enrollment per student is active at a time.
 *
 *   useEnrollments(params, { enabled })  paginated list (no `search`); params: page, limit, sortBy,
 *                                        sortOrder, studentId ('me'), classId, status, academicYear
 *   useEnrollStudent() [form]            mutate({ studentId, classId })
 *   useEnrollStudents() [form]           mutate({ classId, studentIds }) bulk, all or nothing
 *   useTransferStudent() [form]          mutate({ studentId, classId }) one request, no half-done state
 *   useSetEnrollmentStatus()             mutate({ id, status }) status 'completed' | 'withdrawn'
 *
 * Every write refreshes enrollments, students, classes (student counts), the attendance sheets and
 * grade rosters (they list the enrolled students) and the dashboard.
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fullName } from '../../utils/names';
import { attendanceKeys } from '../attendance/keys';
import { classKeys } from '../classes/keys';
import { dashboardKeys } from '../dashboard/keys';
import { gradeKeys } from '../grades/keys';
import { studentKeys } from '../students/keys';
import { enrollStudent, enrollStudents, listEnrollments, setEnrollmentStatus, transferStudent } from './api';
import { enrollmentKeys } from './keys';

export function useEnrollments(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: () => listEnrollments(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidateEnrollments() {
  const invalidate = useInvalidate();
  return () =>
    invalidate(
      enrollmentKeys.all,
      studentKeys.all,
      classKeys.all,
      attendanceKeys.all,
      gradeKeys.all,
      dashboardKeys.all,
    );
}

export function useEnrollStudent() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: enrollStudent,
    meta: { silent: true },
    onSuccess: (enrollment) => {
      invalidateEnrollments();
      toast.success(`${fullName(enrollment.student)} enrolled in ${enrollment.class.name}`);
    },
  });
}

export function useEnrollStudents() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: enrollStudents,
    meta: { silent: true },
    onSuccess: ({ created, enrollments }) => {
      invalidateEnrollments();
      toast.success(
        `${created} ${created === 1 ? 'student' : 'students'} enrolled in ${enrollments[0].class.name}`,
      );
    },
  });
}

export function useTransferStudent() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: transferStudent,
    meta: { silent: true },
    onSuccess: (enrollment) => {
      invalidateEnrollments();
      toast.success(`${fullName(enrollment.student)} transferred to ${enrollment.class.name}`);
    },
  });
}

export function useSetEnrollmentStatus() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, status }) => setEnrollmentStatus(id, status),
    onSuccess: (enrollment) => {
      invalidateEnrollments();
      toast.success(
        `${fullName(enrollment.student)} marked as ${enrollment.status} in ${enrollment.class.name}`,
      );
    },
  });
}
