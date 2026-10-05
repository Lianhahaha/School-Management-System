/**
 * SQL for grades: one score per student per assessment.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, joinClassSubject } from '../../utils/sql.js';
import { ROSTER_STUDENT_IDS } from '../assessments/assessments.repository.js';

export const GRADE_SORT_MAP = { assessedOn: 'a.assessed_on', score: 'g.score', createdAt: 'g.created_at' };

const COLUMNS = `g.id, g.assessment_id, a.title, a.type, a.term, a.max_score, a.assessed_on, a.class_subject_id,
  c.name AS class_name, sub.name AS subject_name, g.student_id, s.student_number, u.first_name, u.last_name,
  g.score, g.remarks, g.graded_by, gu.first_name AS grader_first_name, gu.last_name AS grader_last_name,
  g.created_at, g.updated_at`;

const FROM = `FROM grades g
  JOIN assessments a ON a.id = g.assessment_id
  ${joinClassSubject('a')}
  JOIN students s ON s.id = g.student_id
  JOIN users u ON u.id = s.user_id
  JOIN users gu ON gu.id = g.graded_by`;

/** Filters shared by the flat list and the summary. */
function filtersToWhere(filters, scope) {
  return new WhereBuilder()
    .addIf(filters.studentId, 'g.student_id = ?')
    .addIf(filters.assessmentId, 'g.assessment_id = ?')
    .addIf(filters.classSubjectId, 'a.class_subject_id = ?')
    .addIf(filters.classId, 'cs.class_id = ?')
    .addIf(filters.term, 'a.term = ?')
    .addIf(filters.type, 'a.type = ?')
    .addScope(scope);
}

export async function findGradeById(id) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE g.id = ?`, [id]))[0] ?? null;
}

export function listGrades(listQuery, scope) {
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where: filtersToWhere(listQuery, scope),
    listQuery,
    sortMap: GRADE_SORT_MAP,
    defaultOrder: 'a.assessed_on DESC',
    tieBreaker: 'g.id',
  });
}

/** Newest grades of one student (dashboards). */
export function findRecentGrades(studentId, limit) {
  return query(
    `SELECT ${COLUMNS} ${FROM} WHERE g.student_id = ? ORDER BY a.assessed_on DESC, g.id DESC LIMIT ${Number(limit)}`,
    [studentId],
  );
}

const TOTALS = `COUNT(g.id) AS assessments_graded, SUM(g.score) AS total_score, SUM(a.max_score) AS total_max_score`;

/**
 * Graded points per class-subject (default) or per student and class-subject, split by assessment type, so the
 * service can apply each subject's weights (utils/grading.js).
 */
export function summarizeGrades({ groupBy = 'classSubject', ...filters }, scope) {
  const where = filtersToWhere(filters, scope);
  if (groupBy === 'student') {
    return query(
      `SELECT s.id AS student_id, CONCAT(u.first_name, ' ', u.last_name) AS label, cs.id AS class_subject_id,
              cs.subject_id, a.type, ${TOTALS} ${FROM} ${where.sql}
        GROUP BY s.id, u.first_name, u.last_name, cs.id, cs.subject_id, a.type
        ORDER BY u.last_name, u.first_name, s.id, cs.id`,
      where.params,
    );
  }
  return query(
    `SELECT cs.id AS class_subject_id, cs.subject_id, sub.name AS subject_name, c.name AS class_name,
            c.academic_year, CONCAT(c.name, ' - ', sub.name) AS label, a.type, ${TOTALS} ${FROM} ${where.sql}
      GROUP BY cs.id, cs.subject_id, c.name, c.academic_year, sub.name, a.type
      ORDER BY c.academic_year DESC, c.name, sub.name, cs.id`,
    where.params,
  );
}

/** Assessments joined to their roster students (`roster.student_id`, see ROSTER_STUDENT_IDS). */
const ROSTER_FROM = `FROM assessments a
  JOIN class_subjects cs ON cs.id = a.class_subject_id
  CROSS JOIN LATERAL (${ROSTER_STUDENT_IDS}) roster`;

/** The assessment's roster with each student's score; ungraded rows have null score. */
export function findRosterRows(assessmentId) {
  return query(
    `SELECT s.id AS student_id, s.student_number, u.first_name, u.last_name,
            g.id AS grade_id, g.score, g.remarks, g.graded_by,
            gu.first_name AS grader_first_name, gu.last_name AS grader_last_name, g.updated_at
       ${ROSTER_FROM}
       JOIN students s ON s.id = roster.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grades g ON g.assessment_id = a.id AND g.student_id = s.id
       LEFT JOIN users gu ON gu.id = g.graded_by
      WHERE a.id = ?
      ORDER BY u.last_name, u.first_name, s.id`,
    [assessmentId],
  );
}

export async function findRosterStudentIds(assessmentId, conn) {
  const rows = await query(`SELECT roster.student_id ${ROSTER_FROM} WHERE a.id = ?`, [assessmentId], conn);
  return rows.map((row) => row.studentId);
}

/**
 * Inserts or updates one grade per row. A row whose score and remarks are unchanged keeps its grader, so
 * re-saving a whole sheet to fix one score does not make the saver "graded by" for everyone. `graded_by` is
 * assigned first on purpose: MySQL applies the assignments left to right, so it still compares the old values.
 * Idempotent on UNIQUE(assessment, student); needs MySQL >= 8.0.19 (row alias).
 */
export async function upsertGrades(assessmentId, grades, gradedBy, conn) {
  const rows = grades.map((g) => [assessmentId, g.studentId, g.score, g.remarks ?? null, gradedBy]);
  await run(
    `INSERT INTO grades (assessment_id, student_id, score, remarks, graded_by) VALUES ? AS new
     ON DUPLICATE KEY UPDATE
       graded_by = IF(grades.score <=> new.score AND grades.remarks <=> new.remarks, grades.graded_by, new.graded_by),
       score = new.score,
       remarks = new.remarks`,
    [rows],
    conn,
  );
}

export async function deleteGrade(id) {
  return (await run('DELETE FROM grades WHERE id = ?', [id])).affectedRows;
}
