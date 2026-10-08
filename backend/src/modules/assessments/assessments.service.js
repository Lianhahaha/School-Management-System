import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { addDaysYmd, todayYmd } from '../../utils/dates.js';
import { classSubjectRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, record } from '../activity/activity.service.js';
import * as repo from './assessments.repository.js';

const toAssessmentShape = (row) => ({
  id: row.id,
  classSubjectId: row.classSubjectId,
  classSubject: classSubjectRef(row),
  title: row.title,
  type: row.type,
  term: row.term,
  maxScore: row.maxScore,
  assessedOn: row.assessedOn,
  gradedCount: row.gradedCount,
  enrolledCount: row.enrolledCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listAssessments(user, listQuery) {
  await access.assertFiltersInScope(user, listQuery);
  const { rows, meta } = await repo.listAssessments(listQuery, access.classScope(user, 'cs.class_id'));
  return { data: rows.map(toAssessmentShape), meta };
}

/** Assessment the caller may read. */
export async function getAssessment(user, id) {
  const row = ApiError.assertFound(await repo.findAssessmentById(id), 'assessment', id);
  await access.assertCanViewClassSubject(user, row.classSubjectId);
  return toAssessmentShape(row);
}

/** Assessment the caller may modify (admin, or the teacher who owns its class-subject). */
export async function getManagedAssessment(user, id) {
  const row = ApiError.assertFound(await repo.findAssessmentById(id), 'assessment', id);
  await access.assertCanManageClassSubject(user, row.classSubjectId);
  return toAssessmentShape(row);
}

/** "Quiz 1 of Mathematics · Grade 10 - A" for the activity log. */
export const describeAssessment = (assessment) =>
  `${assessment.title} of ${assessment.classSubject.subjectName} · ${assessment.classSubject.className}`;

const assessmentFields = ({ title, type, term, maxScore, assessedOn }) => ({
  title,
  type,
  term,
  maxScore,
  assessedOn,
});

export async function createAssessment(user, body) {
  await access.assertCanManageClassSubject(user, body.classSubjectId);
  const id = await repo.insertAssessment({ ...body, assessedOn: body.assessedOn ?? todayYmd() });
  const assessment = toAssessmentShape(await repo.findAssessmentById(id));
  await record({
    action: 'assessment.create',
    entityId: id,
    summary: `Created ${describeAssessment(assessment)} (out of ${assessment.maxScore})`,
    details: assessmentFields(assessment),
  });
  return assessment;
}

export async function updateAssessment(user, id, patch) {
  const before = await getManagedAssessment(user, id);
  await withTransaction(async (conn) => {
    if (patch.maxScore !== undefined) {
      // Lock first: a grade save running now finishes before the check, and none starts until this commits.
      ApiError.assertFound(await repo.lockMaxScore(id, conn), 'assessment', id);
      const highest = await repo.findHighestScore(id, conn);
      if (highest !== null && patch.maxScore < highest) {
        throw ApiError.conflict('a recorded score is higher than the new maximum', {
          reason: 'max_score_below_grades',
          maxExistingScore: highest,
        });
      }
    }
    await repo.updateAssessment(id, patch, conn);
  });
  const assessment = toAssessmentShape(await repo.findAssessmentById(id));
  const changes = changesOf(assessmentFields(before), assessmentFields(assessment));
  if (changes) {
    await record({
      action: 'assessment.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of ${describeAssessment(assessment)}`,
      details: { changes },
    });
  }
  return assessment;
}

/**
 * Inside `conn`'s transaction: the assessment's current max score, locked until the transaction ends so it
 * cannot be lowered and no other grade save of this assessment runs meanwhile. 404 when it is gone.
 */
export async function lockMaxScoreForGrading(id, conn) {
  return ApiError.assertFound(await repo.lockMaxScore(id, conn), 'assessment', id);
}

/** Deletes the assessment and its grades in one transaction (the UI confirms with the graded count first). */
export async function deleteAssessment(user, id) {
  const assessment = await getManagedAssessment(user, id);
  await withTransaction((conn) => repo.deleteAssessmentWithGrades(id, conn));
  await record({
    action: 'assessment.delete',
    entityId: id,
    summary: `Deleted ${describeAssessment(assessment)}${
      assessment.gradedCount
        ? ` and its ${assessment.gradedCount} grade${assessment.gradedCount === 1 ? '' : 's'}`
        : ''
    }`,
    details: { ...assessmentFields(assessment), gradedCount: assessment.gradedCount },
  });
  return { id };
}

/** Upcoming assessments within `days` from today, optionally for one class (dashboards; no access check). */
export async function upcomingAssessmentsUnscoped({ classId, days = 7, limit = 10 }) {
  const today = todayYmd();
  const rows = await repo.findUpcoming({ classId, from: today, to: addDaysYmd(today, days), limit });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    assessedOn: row.assessedOn,
    className: row.className,
    subjectName: row.subjectName,
  }));
}

/** Assessments of a teacher dated up to today that still lack grades (dashboards; no access check). */
export async function pendingGradingUnscoped(teacherId, academicYear, limit = 10) {
  const rows = await repo.findPendingGrading(teacherId, academicYear, todayYmd(), limit);
  return rows.map((row) => ({
    assessmentId: row.assessmentId,
    title: row.title,
    className: row.className,
    subjectName: row.subjectName,
    assessedOn: row.assessedOn,
    graded: row.graded,
    enrolled: row.enrolled,
  }));
}
