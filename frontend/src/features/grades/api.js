import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

// --- Assessments (a test, exam or assignment of one class-subject) ---------------------------------

/**
 * params: page, limit, search (title), sortBy (assessedOn, title, type, createdAt), sortOrder,
 * classSubjectId, classId, type, semester, term (the quarter), dateFrom, dateTo. Teachers and students only
 * see their visible set.
 */
export const listAssessments = (params) => api.get('/assessments', { params }).then(toPage);

export const getAssessment = (id) => api.get(`/assessments/${id}`).then(toData);

/**
 * Admin, or the class-subject's teacher. Body: { classSubjectId, title, type, semester, term, maxScore,
 * assessedOn? }; `term` is the quarter within the semester.
 */
export const createAssessment = (body) => api.post('/assessments', body).then(toData);

/**
 * Admin, or the class-subject's teacher. Any of title, type, semester, term, maxScore, assessedOn (the
 * class-subject is fixed).
 */
export const updateAssessment = (id, body) => api.patch(`/assessments/${id}`, body).then(toData);

/** Admin, or the class-subject's teacher. Also removes the assessment's recorded grades. */
export const deleteAssessment = (id) => api.delete(`/assessments/${id}`).then(toData);

// --- Grade sheet of one assessment ------------------------------------------------------------------

/** Admin and teachers. { assessmentId, assessment, records: [{ studentId, ..., gradeId, score, ... }] }, null when ungraded. */
export const getGradeRoster = (assessmentId) => api.get(`/assessments/${assessmentId}/grades`).then(toData);

/**
 * Admin, or the class-subject's teacher. Idempotent upsert of the listed students; resolves the roster.
 * grades: [{ studentId, score, remarks? }], 1..200 rows, only rows that have a score.
 */
export const saveGrades = (assessmentId, grades) =>
  api.put(`/assessments/${assessmentId}/grades`, { grades }).then(toData);

// --- Recorded grades --------------------------------------------------------------------------------

/**
 * Flat grade rows. params: page, limit, sortBy (assessedOn, score, createdAt), sortOrder, studentId ('me'
 * allowed), classSubjectId, classId, academicYear, semester, term (the quarter), assessmentId, type. This
 * list does not accept `search`.
 */
export const listGrades = (params) => api.get('/grades', { params }).then(toPage);

/**
 * Summary of the grades of a scope. params: studentId ('me'), classSubjectId, classId, academicYear,
 * semester, term (the quarter), groupBy ('classSubject' default | 'student'; students cannot group by student).
 * Resolves an array of rows with { label, assessmentsGraded, totalScore, totalMaxScore, percentage, method }:
 * `percentage` is the grade of the scope (the semester's with `semester`, the school year's without), and a
 * classSubject row has `quarters` ({ term1..term4 }) with `semester` and `semesters` ({ sem1, sem2 })
 * without. The rows carry no `semester`: tag the ones fetched with it (utils/grades tagSemester) before
 * handing them to subjectSemesters, subjectFinalGrade or generalAverage.
 */
export const getGradeSummary = (params) => api.get('/grades/summary', { params }).then(toData);

/**
 * Admin, or the class-subject's teacher. Clears one recorded grade (a PUT cannot unset a score). `score` and
 * `remarks` are the grade as the sheet shows it: when someone changed or cleared it meanwhile the API answers
 * 409 with `details.reason = sheet_changed` and nothing is cleared, as for a save.
 * @param {{ id: number, score: number, remarks?: string | null }} grade
 */
export const deleteGrade = ({ id, score, remarks }) =>
  api.delete(`/grades/${id}`, { params: { score, remarks: remarks ?? undefined } }).then(toData);
