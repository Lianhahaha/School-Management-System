/**
 * Grades: roster-with-scores per assessment, bulk entry, flat reads and summaries.
 * Summaries are points-weighted: percentage = SUM(score) / SUM(max_score) * 100 over graded assessments.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { getAssessment, getManagedAssessment } from '../assessments/assessments.service.js';
import * as repo from './grades.repository.js';

const percentage = (score, maxScore) => (maxScore ? Math.round((score / maxScore) * 10000) / 100 : null);

const toAssessmentRef = ({
  id,
  title,
  type,
  maxScore,
  term,
  assessedOn,
  classSubjectId,
  subjectName,
  className,
}) => ({
  id,
  title,
  type,
  maxScore,
  term,
  assessedOn,
  classSubjectId,
  subjectName,
  className,
});

const toGradeShape = (row) => ({
  id: row.id,
  assessmentId: row.assessmentId,
  assessment: toAssessmentRef({ ...row, id: row.assessmentId }),
  studentId: row.studentId,
  student: {
    id: row.studentId,
    studentNumber: row.studentNumber,
    firstName: row.firstName,
    lastName: row.lastName,
  },
  score: row.score,
  percentage: percentage(row.score, row.maxScore),
  remarks: row.remarks,
  gradedBy: personRef(row.gradedBy, row.graderFirstName, row.graderLastName),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toSummaryRow = (row) => ({
  ...(row.studentId !== undefined && { studentId: row.studentId }),
  ...(row.classSubjectId !== undefined && { classSubjectId: row.classSubjectId }),
  ...(row.subjectName !== undefined && { subjectName: row.subjectName }),
  label: row.label,
  assessmentsGraded: row.assessmentsGraded,
  totalScore: row.totalScore,
  totalMaxScore: row.totalMaxScore,
  percentage: percentage(row.totalScore, row.totalMaxScore),
});

/** Applies the scoping rule shared by list and summary: own grades for students, visible classes for teachers. */
async function scopeFilters(user, filters) {
  await access.assertFiltersInScope(user, filters);
  const studentId = access.scopedStudentId(user, resolveMe(user, filters.studentId, 'student'));
  const scope = access.isStudent(user) ? null : access.classScope(user, 'cs.class_id');
  return { filters: { ...filters, studentId }, scope };
}

export async function listGrades(user, listQuery) {
  const { filters, scope } = await scopeFilters(user, listQuery);
  const { rows, meta } = await repo.listGrades(filters, scope);
  return { data: rows.map(toGradeShape), meta };
}

export async function getSummary(user, query) {
  if (query.groupBy === 'student' && access.isStudent(user)) {
    throw ApiError.forbidden('group_by_student_not_allowed', 'students cannot group grades by student');
  }
  const { filters, scope } = await scopeFilters(user, query);
  return (await repo.summarizeGrades(filters, scope)).map(toSummaryRow);
}

/** Unscoped per-subject summary of one student (dashboards; the caller did the access checks). */
export async function summarizeStudentGrades(studentId, classId) {
  return (await repo.summarizeGrades({ groupBy: 'classSubject', studentId, classId }, null)).map(
    toSummaryRow,
  );
}

/** Newest grades of a student (dashboards; the caller did the access checks). */
export async function recentGrades(studentId, limit = 5) {
  return (await repo.findRecentGrades(studentId, limit)).map(toGradeShape);
}

async function buildRoster(assessment) {
  const rows = await repo.findRosterRows(assessment.id);
  return {
    assessmentId: assessment.id,
    assessment: toAssessmentRef({
      ...assessment,
      subjectName: assessment.classSubject.subjectName,
      className: assessment.classSubject.className,
    }),
    records: rows.map((row) => ({
      studentId: row.studentId,
      studentNumber: row.studentNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      gradeId: row.gradeId,
      score: row.score,
      percentage: row.gradeId ? percentage(row.score, assessment.maxScore) : null,
      remarks: row.remarks,
      gradedBy: personRef(row.gradedBy, row.graderFirstName, row.graderLastName),
      updatedAt: row.updatedAt,
    })),
  };
}

export async function getRoster(user, assessmentId) {
  return buildRoster(await getAssessment(user, assessmentId));
}

/** Idempotent bulk upsert of the listed students only; the whole batch is rejected when any row is invalid. */
export async function saveGrades(user, assessmentId, { grades }) {
  const assessment = await getManagedAssessment(user, assessmentId);
  const tooHigh = grades.find((grade) => grade.score > assessment.maxScore);
  if (tooHigh) {
    throw ApiError.validation('score exceeds maxScore', undefined, {
      reason: 'score_above_max',
      studentId: tooHigh.studentId,
      score: tooHigh.score,
      maxScore: assessment.maxScore,
    });
  }
  await withTransaction(async (conn) => {
    const roster = new Set(await repo.findRosterStudentIds(assessmentId, conn));
    const invalidStudentIds = grades.map((g) => g.studentId).filter((id) => !roster.has(id));
    if (invalidStudentIds.length) {
      throw ApiError.validation('students are not enrolled in this class', undefined, {
        reason: 'not_enrolled',
        invalidStudentIds,
      });
    }
    await repo.upsertGrades(assessmentId, grades, user.id, conn);
  });
  return buildRoster(assessment);
}

export async function deleteGrade(user, id) {
  const grade = ApiError.assertFound(await repo.findGradeById(id), 'grade', id);
  await access.assertCanManageClassSubject(user, grade.classSubjectId);
  await repo.deleteGrade(id);
  return { id };
}
