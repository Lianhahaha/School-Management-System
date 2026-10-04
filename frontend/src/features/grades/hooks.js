/**
 * Assessments and grades (one cache scope, so every write refreshes both).
 *
 * Assessments
 *   useAssessments(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                        classSubjectId, classId, type, term, dateFrom, dateTo
 *   useAssessment(id)                    one assessment, with gradedCount and enrolledCount
 *   useCreateAssessment() [form]         mutate(body) with the createAssessmentSchema output
 *   useUpdateAssessment() [form]         mutate({ id, body }) with the updateAssessmentSchema output
 *   useDeleteAssessment()                mutate(id) removes its grades too
 * Grade sheet
 *   useGradeRoster(assessmentId)         roster with scores
 *   useSaveGrades()                      mutate({ assessmentId, grades }) resolves the saved roster; grades from toSaveGradesPayload
 * Recorded grades
 *   useGrades(params, { enabled })       flat rows (no `search`); params: page, limit, sortBy, sortOrder,
 *                                        studentId ('me'), classSubjectId, classId, term, assessmentId, type
 *   useGradeSummary(params, { enabled }) per-subject (or per-student) points-weighted percentages; params:
 *                                        studentId ('me'), classSubjectId, classId, term, groupBy
 *   useDeleteGrade()                     mutate(id) clears one grade
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { dashboardKeys } from '../dashboard/keys';
import {
  createAssessment,
  deleteAssessment,
  deleteGrade,
  getAssessment,
  getGradeRoster,
  getGradeSummary,
  listAssessments,
  listGrades,
  saveGrades,
  updateAssessment,
} from './api';
import { gradeKeys } from './keys';

export function useAssessments(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: gradeKeys.list(params),
    queryFn: () => listAssessments(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAssessment(id) {
  return useQuery({ queryKey: gradeKeys.detail(id), queryFn: () => getAssessment(id), enabled: Boolean(id) });
}

export function useGradeRoster(assessmentId) {
  return useQuery({
    queryKey: gradeKeys.roster(assessmentId),
    queryFn: () => getGradeRoster(assessmentId),
    enabled: Boolean(assessmentId),
    meta: { live: false }, // a teacher is editing this sheet
  });
}

export function useGrades(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: gradeKeys.records(params),
    queryFn: () => listGrades(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useGradeSummary(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: gradeKeys.summary(params),
    queryFn: () => getGradeSummary(params),
    enabled,
  });
}

/** Refreshes assessments, rosters, grades and summaries (one scope) and the dashboards. */
function useInvalidateGrades() {
  const invalidate = useInvalidate();
  return () => invalidate(gradeKeys.all, dashboardKeys.all);
}

export function useCreateAssessment() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: createAssessment,
    meta: { silent: true },
    onSuccess: (assessment) => {
      invalidateGrades();
      toast.success(`${assessment.title} created`);
    },
  });
}

export function useUpdateAssessment() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }) => updateAssessment(id, body),
    meta: { silent: true },
    onSuccess: (assessment) => {
      invalidateGrades();
      toast.success(`${assessment.title} updated`);
    },
  });
}

export function useDeleteAssessment() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => {
      invalidateGrades();
      toast.success('Assessment deleted');
    },
  });
}

export function useSaveGrades() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ assessmentId, grades }) => saveGrades(assessmentId, grades),
    onSuccess: ({ records }) => {
      invalidateGrades();
      const graded = records.filter((record) => record.gradeId !== null).length;
      toast.success(`Grades saved (${graded} of ${records.length} graded)`);
    },
  });
}

export function useDeleteGrade() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteGrade,
    onSuccess: () => {
      invalidateGrades();
      toast.success('Grade cleared');
    },
  });
}
