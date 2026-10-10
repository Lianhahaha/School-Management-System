/**
 * Enrollments: which class a student is in. Only one enrollment per student is active at a time.
 *
 *   useEnrollments(params, { enabled })  paginated list (no `search`); params: page, limit, sortBy,
 *                                        sortOrder, studentId ('me'), classId, status, academicYear
 *   useSchoolYear(studentId, requested, currentEnrollment)
 *                                        the student's school years and the one a page shows
 *   useEnrollStudent() [form]            mutate({ studentId, classId })
 *   useEnrollStudents() [form]           mutate({ classId, studentIds }) bulk, all or nothing
 *   useTransferStudent() [form]          mutate({ studentId, classId }) one request, no half-done state
 *   useSetEnrollmentStatus()             mutate({ id, status }) status 'completed' | 'withdrawn'
 *   useCompleteSchoolYear() [form]       mutate({ classId, studentIds, nextClassId? }) all or nothing
 *   useNextClass({ enabled })            the signed-in student's standing for next year
 *   useEnrollMyself()                    mutate(classId) the student enrolls in an offered section
 *
 * Every write refreshes enrollments, students, classes (student counts), the attendance sheets and
 * grade rosters (they list the enrolled students) and the dashboard; a student's own enrollment also
 * refreshes their account (`currentEnrollment`).
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { PAGINATION } from '../../constants/shared';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { countOf } from '../../utils/format';
import { fullName } from '../../utils/names';
import { attendanceKeys } from '../attendance/keys';
import { authKeys } from '../auth/keys';
import { classKeys } from '../classes/keys';
import { dashboardKeys } from '../dashboard/keys';
import { gradeKeys } from '../grades/keys';
import { studentKeys } from '../students/keys';
import {
  completeSchoolYear,
  enrollMyself,
  enrollStudent,
  enrollStudents,
  getNextClass,
  listEnrollments,
  setEnrollmentStatus,
  transferStudent,
} from './api';
import { enrollmentKeys, nextClassKey } from './keys';
import { defaultSchoolYear, schoolYearsOf, yearChoices } from './schoolYears';

export function useEnrollments(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: () => listEnrollments(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * The school years a student can pick (`years`, newest first, each with that year's class or null) and the
 * one to show: `requested` (from the URL) when it is one of them, else the default year (see schoolYears.js).
 * One page of 100 enrollments covers any real school career.
 * @param {number|'me'} studentId
 * @param {string} requested an academic year label, or '' for the default
 * @param {{ academicYear: string } | null} currentEnrollment
 */
export function useSchoolYear(studentId, requested, currentEnrollment) {
  const params = { studentId, sortBy: 'enrolledOn', sortOrder: 'asc', limit: PAGINATION.MAX_LIMIT };
  const query = useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: () => listEnrollments(params),
    select: (page) => schoolYearsOf(page.items),
    meta: { live: false }, // a student's school years change once a year
  });
  const schoolYears = query.data ?? [];
  const years = yearChoices(schoolYears);
  const academicYear = years.some((year) => year.academicYear === requested)
    ? requested
    : defaultSchoolYear(currentEnrollment, schoolYears);
  const className = years.find((year) => year.academicYear === academicYear)?.className ?? null;
  return {
    years,
    academicYear,
    className,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
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
      toast.success(`${countOf(created, 'student')} enrolled in ${enrollments[0].class.name}`);
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

export function useCompleteSchoolYear() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: completeSchoolYear,
    meta: { silent: true },
    onSuccess: ({ completed, enrollments }) => {
      invalidateEnrollments();
      const moved = enrollments.length > 0 ? ` and moved to ${enrollments[0].class.name}` : '';
      toast.success(`School year completed for ${countOf(completed, 'student')}${moved}`);
    },
  });
}

export function useNextClass({ enabled = true } = {}) {
  return useQuery({ queryKey: nextClassKey, queryFn: getNextClass, enabled });
}

export function useEnrollMyself() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const invalidate = useInvalidate();
  const toast = useToast();
  return useMutation({
    mutationFn: enrollMyself,
    onSuccess: (enrollment) => {
      invalidateEnrollments();
      invalidate(authKeys.me());
      toast.success(`You are enrolled in ${enrollment.class.name}, ${enrollment.class.academicYear}`);
    },
  });
}

export function useSetEnrollmentStatus() {
  const invalidateEnrollments = useInvalidateEnrollments();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ id: number, status: 'completed' | 'withdrawn' }} */ { id, status }) =>
      setEnrollmentStatus(id, status),
    onSuccess: (enrollment) => {
      invalidateEnrollments();
      toast.success(
        `${fullName(enrollment.student)} marked as ${enrollment.status} in ${enrollment.class.name}`,
      );
    },
  });
}
