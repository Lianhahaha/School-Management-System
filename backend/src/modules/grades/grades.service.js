/**
 * Grades: roster-with-scores per assessment, bulk entry, flat reads and summaries.
 * A subject's result is on points (SUM(score) / SUM(max_score) * 100 over graded assessments) or, when the
 * subject has grade weights, weighted per assessment type; a student's result over several subjects is the
 * mean of the subject results. The arithmetic lives in utils/grading.js.
 */
import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { generalAverageOf, percentOf, subjectResult, sumPoints } from '../../utils/grading.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyStudents } from '../notifications/notifications.service.js';
import {
  describeAssessment,
  getAssessment,
  getManagedAssessment,
  lockMaxScoreForGrading,
} from '../assessments/assessments.service.js';
import { gradeWeightsBySubject } from '../subjects/subjects.service.js';
import * as repo from './grades.repository.js';

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
  percentage: percentOf(row.score, row.maxScore),
  remarks: row.remarks,
  gradedBy: personRef(row.gradedBy, row.graderFirstName, row.graderLastName),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Rows grouped by `keyOf(row)`, groups in the order their first row appears: Map key -> rows. */
function groupRows(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

/** Counts and points of a group of per-type rows. */
const totalsOf = (rows) => ({
  assessmentsGraded: rows.reduce((sum, row) => sum + row.assessmentsGraded, 0),
  totalScore: sumPoints(rows.map((row) => row.totalScore)),
  totalMaxScore: sumPoints(rows.map((row) => row.totalMaxScore)),
});

/**
 * Folds the per-type rows of repo.summarizeGrades into summary rows:
 *   classSubject  one row per class-subject: its result (`method` points or weighted) and the weights used;
 *   student       one row per student: the result of their one class-subject, or the general average of
 *                 several (`average`), each subject counting once per academic year (utils/grading.js).
 */
async function foldSummary(rows, groupBy) {
  const weights = await gradeWeightsBySubject(rows.map((row) => row.subjectId));
  const classSubjectResult = (typeRows) => subjectResult(typeRows, weights.get(typeRows[0].subjectId));

  if (groupBy === 'student') {
    return [...groupRows(rows, (row) => row.studentId).values()].map((studentRows) => {
      const results = [...groupRows(studentRows, (row) => row.classSubjectId).values()].map((typeRows) => ({
        ...classSubjectResult(typeRows),
        subjectId: typeRows[0].subjectId,
        academicYear: typeRows[0].academicYear,
      }));
      const result =
        results.length === 1
          ? { percentage: results[0].percentage, method: results[0].method }
          : { percentage: generalAverageOf(results), method: 'average' };
      return {
        studentId: studentRows[0].studentId,
        label: studentRows[0].label,
        ...totalsOf(studentRows),
        ...result,
      };
    });
  }
  return [...groupRows(rows, (row) => row.classSubjectId).values()].map((typeRows) => {
    const first = typeRows[0];
    return {
      classSubjectId: first.classSubjectId,
      subjectId: first.subjectId,
      subjectName: first.subjectName,
      className: first.className,
      academicYear: first.academicYear,
      label: first.label,
      ...totalsOf(typeRows),
      ...classSubjectResult(typeRows),
      gradeWeights: weights.get(first.subjectId),
    };
  });
}

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
  return foldSummary(await repo.summarizeGrades(filters, scope), filters.groupBy);
}

/**
 * Unscoped per-class-subject summary of one student in an academic year, every class of that year included
 * (a student who changed class keeps the grades of the first one) (dashboards; the caller did the checks).
 */
export async function summarizeStudentGradesUnscoped(studentId, academicYear) {
  const filters = { groupBy: 'classSubject', studentId, academicYear };
  return foldSummary(await repo.summarizeGrades(filters, null), filters.groupBy);
}

/**
 * Each student's result in an academic year, within `scope` (a class scope fragment on cs.class_id, null for
 * all): the mean of their subject results, or their one subject's result (dashboards; no access check).
 * @returns {Promise<Map<number, number | null>>} studentId -> percentage
 */
export async function studentResultsUnscoped(academicYear, scope) {
  const filters = { groupBy: 'student', academicYear };
  const rows = await foldSummary(await repo.summarizeGrades(filters, scope), filters.groupBy);
  return new Map(rows.map((row) => [row.studentId, row.percentage]));
}

/** Newest grades of a student (dashboards; the caller did the access checks). */
export async function recentGradesUnscoped(studentId, limit = 5) {
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
      percentage: row.gradeId ? percentOf(row.score, assessment.maxScore) : null,
      remarks: row.remarks,
      gradedBy: personRef(row.gradedBy, row.graderFirstName, row.graderLastName),
      updatedAt: row.updatedAt,
    })),
  };
}

export async function getRoster(user, assessmentId) {
  return buildRoster(await getAssessment(user, assessmentId));
}

/** Blank remarks are no remarks: '' and null compare and store the same. */
const remarksOf = (value) => value || null;

/** True when the stored grade (or its absence) is what the client saw (`previous.score` null = ungraded). */
const isAsSeen = (previous, stored) =>
  previous.score === null
    ? stored === undefined
    : stored !== undefined &&
      stored.score === previous.score &&
      remarksOf(stored.remarks) === remarksOf(previous.remarks);

/**
 * Idempotent bulk upsert of the listed students only; the whole batch is rejected when any row is invalid.
 * When the rows carry `previous` and a stored grade no longer matches it, someone saved meanwhile: 409
 * sheet_changed and nothing is written.
 */
export async function saveGrades(user, assessmentId, { grades: input }) {
  await getManagedAssessment(user, assessmentId); // 404 or 403 before anything is locked
  const grades = input.map((grade) => ({ ...grade, remarks: remarksOf(grade.remarks) }));
  let previous;
  await withTransaction(async (conn) => {
    // Checked against the max score as it is now, locked so a concurrent edit cannot lower it under us and
    // other saves of this assessment wait (first statement: the reads below see what they committed).
    const maxScore = await lockMaxScoreForGrading(assessmentId, conn);
    const tooHigh = grades.find((grade) => grade.score > maxScore);
    if (tooHigh) {
      throw ApiError.validation(`a score is above the maximum of ${maxScore}`, undefined, {
        reason: 'score_above_max',
        studentId: tooHigh.studentId,
        score: tooHigh.score,
        maxScore,
      });
    }
    const roster = new Set(await repo.findRosterStudentIds(assessmentId, conn));
    const invalidStudentIds = grades.map((g) => g.studentId).filter((id) => !roster.has(id));
    if (invalidStudentIds.length) {
      throw ApiError.validation('students were not in this class on the assessment date', undefined, {
        reason: 'not_enrolled',
        invalidStudentIds,
      });
    }
    previous = await repo.findGradesOf(
      assessmentId,
      grades.map((grade) => grade.studentId),
      conn,
    );
    const changedStudentIds = grades
      .filter((grade) => grade.previous && !isAsSeen(grade.previous, previous.get(grade.studentId)))
      .map((grade) => grade.studentId);
    if (changedStudentIds.length) {
      throw ApiError.conflict(
        'someone saved these grades after you opened them; reload to see their changes',
        {
          reason: 'sheet_changed',
          changedStudentIds,
        },
      );
    }
    await repo.upsertGrades(assessmentId, grades, user.id, conn);
  });
  // The max score may have changed since `assessment` was read: build the roster from the current row.
  const assessment = await getAssessment(user, assessmentId);
  const roster = await buildRoster(assessment);
  await recordGradeChanges(assessment, roster, grades, previous);
  return roster;
}

/**
 * Logs the new and changed grades of a save (score or remarks), with each student's previous score; unchanged
 * rows are left out. Students hear about new grades and changed scores, not about remark edits.
 */
async function recordGradeChanges(assessment, roster, grades, previous) {
  const nameOfStudent = new Map(roster.records.map((record) => [record.studentId, nameOf(record)]));
  const changes = grades
    .map((grade) => ({ grade, before: previous.get(grade.studentId) }))
    .filter(
      ({ grade, before }) =>
        !before || before.score !== grade.score || remarksOf(before.remarks) !== grade.remarks,
    )
    .map(({ grade, before }) => ({
      studentId: grade.studentId,
      student: nameOfStudent.get(grade.studentId),
      from: before ? before.score : null,
      to: grade.score,
      ...(before &&
        remarksOf(before.remarks) !== grade.remarks && {
          remarks: { from: remarksOf(before.remarks), to: grade.remarks },
        }),
    }));
  if (!changes.length) return;
  const added = changes.filter((change) => change.from === null).length;
  const parts = [added && `${added} new`, changes.length - added && `${changes.length - added} changed`];
  await record({
    action: 'grades.save',
    entityId: assessment.id,
    summary: `Graded ${describeAssessment(assessment)}: ${parts.filter(Boolean).join(', ')}`,
    details: { assessment: assessment.title, maxScore: assessment.maxScore, changes },
  });
  await notifyStudents(
    changes
      .filter((change) => change.from !== change.to)
      .map((change) => ({
        studentId: change.studentId,
        type: 'grade',
        title: `${change.from === null ? 'New grade' : 'Grade updated'}: ${assessment.title}`,
        body: `${assessment.classSubject.subjectName} · ${change.to} / ${assessment.maxScore}${
          change.from === null ? '' : ` (was ${change.from})`
        }`,
        link: '/student/grades',
      })),
  );
}

export async function deleteGrade(user, id) {
  const grade = ApiError.assertFound(await repo.findGradeById(id), 'grade', id);
  await access.assertCanManageClassSubject(user, grade.classSubjectId);
  await repo.deleteGrade(id);
  await record({
    action: 'grades.delete',
    entityId: grade.assessmentId,
    summary: `Cleared ${nameOf(grade)}'s grade on ${grade.title} of ${grade.subjectName} · ${grade.className} (was ${grade.score} / ${grade.maxScore})`,
    details: { student: nameOf(grade), assessment: grade.title, from: grade.score, to: null },
  });
  return { id };
}
