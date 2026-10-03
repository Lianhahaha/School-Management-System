import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { addDaysYmd, todayYmd } from '../../utils/dates.js';
import { classSubjectRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
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

export async function createAssessment(user, body) {
  await access.assertCanManageClassSubject(user, body.classSubjectId);
  const id = await repo.insertAssessment({ ...body, assessedOn: body.assessedOn ?? todayYmd() });
  return toAssessmentShape(await repo.findAssessmentById(id));
}

export async function updateAssessment(user, id, patch) {
  await getManagedAssessment(user, id);
  if (patch.maxScore !== undefined) {
    const highest = await repo.findHighestScore(id);
    if (highest !== null && patch.maxScore < highest) {
      throw ApiError.conflict('a recorded score is higher than the new maximum', {
        reason: 'max_score_below_grades',
        maxExistingScore: highest,
      });
    }
  }
  await repo.updateAssessment(id, patch);
  return toAssessmentShape(await repo.findAssessmentById(id));
}

/** Deletes the assessment and its grades in one transaction (the UI confirms with the graded count first). */
export async function deleteAssessment(user, id) {
  await getManagedAssessment(user, id);
  await withTransaction((conn) => repo.deleteAssessmentWithGrades(id, conn));
  return { id };
}

/** Upcoming assessments within `days` from today, optionally for one class (dashboards; no access check). */
export async function upcomingAssessments({ classId, days = 7, limit = 10 }) {
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

/** Assessments of a teacher that still lack grades (dashboards; no access check). */
export async function pendingGrading(teacherId, academicYear, limit = 10) {
  const rows = await repo.findPendingGrading(teacherId, academicYear, limit);
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
