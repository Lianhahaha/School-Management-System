/**
 * Assessments and grades (one cache scope, so every write refreshes both).
 *
 * Assessments
 *   useAssessments(params, { enabled })  paginated list; params: page, limit, search, sortBy, sortOrder,
 *                                        classSubjectId, classId, type, semester, term (the quarter),
 *                                        dateFrom, dateTo
 *   useAssessment(id)                    one assessment, with gradedCount and enrolledCount
 *   useCreateAssessment() [form]         mutate(body) with the createAssessmentSchema output
 *   useUpdateAssessment() [form]         mutate({ id, body }) with the updateAssessmentSchema output
 *   useDeleteAssessment()                mutate(id) removes its grades too
 * Grade sheet
 *   useGradeRoster(assessmentId)         roster with scores
 *   useSaveGrades()                      mutate({ assessmentId, grades }) resolves the saved roster; grades from toSaveGradesPayload
 * Recorded grades
 *   useGrades(params, { enabled })       flat rows (no `search`); params: page, limit, sortBy, sortOrder,
 *                                        studentId ('me'), classSubjectId, classId, academicYear, semester,
 *                                        term (the quarter), assessmentId, type
 *   useAllGrades(params)                 every row the filters match (all pages), as an array
 *   useGradeSummary(params, { enabled }) per-subject (or per-student) grades of the scope; params:
 *                                        studentId ('me'), classSubjectId, classId, academicYear, semester,
 *                                        term (the quarter), groupBy
 *   useSemesterSummaries(params, { enabled })
 *                                        a student's per-subject rows of one semester, or of both put
 *                                        together, each tagged with its semester (what generalAverage,
 *                                        subjectSemesters and subjectRows read); params: studentId ('me'),
 *                                        academicYear, semester
 *   useDeleteGrade()                     mutate({ id, score, remarks }) clears one grade, refused (409) if it changed
 *   useRestoreGrade()                    mutate({ assessmentId, grade }) puts a cleared grade back (Undo)
 *
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself
 * (applyServerErrors + FormRootError). Every other mutation raises an error toast.
 */
import { keepPreviousData, useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { SEMESTERS } from '../../constants/shared';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { fetchAllPages } from '../../lib/pagination';
import { isInlineFormError } from '../../lib/formErrors';
import { tagSemester } from '../../utils/grades';
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
  return useQuery({
    queryKey: gradeKeys.detail(id),
    queryFn: () => getAssessment(id),
    enabled: Boolean(id),
    meta: { live: false }, // the grade sheet's header; the sheet's own saves refresh it
  });
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

/** All pages of GET /grades, so a student's year is never cut off (a year is a few hundred rows at most). */
export function useAllGrades(params) {
  return useQuery({
    queryKey: gradeKeys.allRecords(params),
    queryFn: () => fetchAllPages(listGrades, params),
    placeholderData: keepPreviousData,
  });
}

export function useGradeSummary(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: gradeKeys.summary(params),
    queryFn: () => getGradeSummary(params),
    enabled,
  });
}

/** The result of useSemesterSummaries: the rows once every semester asked for has arrived. */
const combineSemesterSummaries = (results) => ({
  data: results.every((result) => result.data !== undefined)
    ? results.flatMap((result) => result.data)
    : undefined,
  isPending: results.some((result) => result.isPending),
  isError: results.some((result) => result.isError),
  error: results.find((result) => result.error)?.error ?? null,
  refetch: () => Promise.all(results.map((result) => result.refetch())),
});

/**
 * The per-subject rows (groupBy classSubject) of a school year's semester, or of both semesters put together
 * when `semester` is omitted, each row tagged with the semester it was fetched for (utils/grades
 * tagSemester). That tag is what the helpers that span rows read: a class-subject's grade of the whole year
 * (subjectRows), a subject taken in two classes (subjectSemesters) and the general average. They need the
 * quarters of each semester, which only a request with `semester` returns, so the whole year is two requests.
 * Each is the request `useGradeSummary` makes for that semester, so choosing between a semester and the
 * whole year costs nothing the second time. Resolves { data (undefined until every request has arrived),
 * isPending, isError, error, refetch }.
 * @param {{ studentId?: number|string, academicYear?: string, semester?: string }} params
 * @param {{ enabled?: boolean }} [options]
 */
export function useSemesterSummaries({ semester, ...params }, { enabled = true } = {}) {
  return useQueries({
    queries: (semester ? [semester] : SEMESTERS).map((name) => {
      const query = { ...params, semester: name, groupBy: 'classSubject' };
      return {
        queryKey: gradeKeys.summary(query),
        queryFn: () => getGradeSummary(query),
        select: (/** @type {object[]} */ rows) => tagSemester(rows, name),
        enabled,
      };
    }),
    combine: combineSemesterSummaries,
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
    mutationFn: (/** @type {{ id: number, body: object }} */ { id, body }) => updateAssessment(id, body),
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
    mutationFn: (/** @type {{ assessmentId: number, grades: object[] }} */ { assessmentId, grades }) =>
      saveGrades(assessmentId, grades),
    onSuccess: ({ records }) => {
      invalidateGrades();
      const graded = records.filter((record) => record.gradeId !== null).length;
      toast.success(`Grades saved (${graded} of ${records.length} graded)`);
    },
  });
}

/**
 * Clears one grade: mutate({ id, score, remarks }) with the values the sheet shows, so the API refuses it (409
 * sheet_changed) when someone saved another score meanwhile. The caller raises the toast, because it knows the
 * student and can offer Undo.
 */
export function useDeleteGrade() {
  const invalidateGrades = useInvalidateGrades();
  return useMutation({
    mutationFn: deleteGrade,
    onSuccess: invalidateGrades,
  });
}

/** Puts one cleared grade back (the Undo of useDeleteGrade): mutate({ assessmentId, grade }). */
export function useRestoreGrade() {
  const invalidateGrades = useInvalidateGrades();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ assessmentId: number, grade: object }} */ { assessmentId, grade }) =>
      saveGrades(assessmentId, [grade]),
    onSuccess: () => {
      invalidateGrades();
      toast.success('Grade restored');
    },
    // No form shows a refused restore (e.g. the maximum was lowered meanwhile), and the global handler
    // leaves validation errors to forms: say it here.
    onError: (error) => {
      if (isInlineFormError(error)) toast.error(`The grade could not be restored: ${error.message}`);
    },
  });
}
