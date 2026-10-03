import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

// --- Assessments (a test, exam or assignment of one class-subject) ---------------------------------

/**
 * params: page, limit, search (title), sortBy (assessedOn, title, type, createdAt), sortOrder,
 * classSubjectId, classId, type, term, dateFrom, dateTo. Teachers and students only see their visible set.
 */
export const listAssessments = (params) => api.get('/assessments', { params }).then(toPage);

export const getAssessment = (id) => api.get(`/assessments/${id}`).then(toData);

/** Admin, or the class-subject's teacher. Body: { classSubjectId, title, type, term, maxScore, assessedOn? }. */
export const createAssessment = (body) => api.post('/assessments', body).then(toData);

/** Admin, or the class-subject's teacher. Any of title, type, term, maxScore, assessedOn (the class-subject is fixed). */
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
 * allowed), classSubjectId, classId, term, assessmentId, type. This list does not accept `search`.
 */
export const listGrades = (params) => api.get('/grades', { params }).then(toPage);

/**
 * Points-weighted summary: percentage = sum(score) / sum(maxScore) * 100 (0 to 100, null when nothing is graded).
 * params: studentId ('me'), classSubjectId, classId, term, groupBy ('classSubject' default | 'student';
 * students cannot group by student). Resolves an array of { label, assessmentsGraded, totalScore, totalMaxScore, percentage }.
 */
export const getGradeSummary = (params) => api.get('/grades/summary', { params }).then(toData);

/** Admin, or the class-subject's teacher. Clears one recorded grade (a PUT cannot unset a score). */
export const deleteGrade = (id) => api.delete(`/grades/${id}`).then(toData);
