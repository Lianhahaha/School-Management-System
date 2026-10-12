/**
 * SQL for grades: one score per student per assessment.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, joinClassSubject } from '../../utils/sql.js';
import { ROSTER_STUDENT_IDS, rosterStudentIds } from '../assessments/assessments.repository.js';

export const GRADE_SORT_MAP = { assessedOn: 'a.assessed_on', score: 'g.score', createdAt: 'g.created_at' };

const COLUMNS = `g.id, g.assessment_id, a.title, a.type, a.semester, a.term, a.max_score, a.assessed_on,
  a.class_subject_id,
  c.name AS class_name, sub.name AS subject_name, g.student_id, s.student_number, u.first_name, u.last_name,
  g.score, g.remarks, g.graded_by, gu.first_name AS grader_first_name, gu.last_name AS grader_last_name,
  g.created_at, g.updated_at`;

const FROM = `FROM grades g
  JOIN assessments a ON a.id = g.assessment_id
  ${joinClassSubject('a')}
  JOIN students s ON s.id = g.student_id
  JOIN users u ON u.id = s.user_id
  JOIN users gu ON gu.id = g.graded_by`;

/** Filters of the flat list. */
function filtersToWhere(filters, scope) {
  return new WhereBuilder()
    .addIf(filters.studentId, 'g.student_id = ?')
    .addIf(filters.assessmentId, 'g.assessment_id = ?')
    .addIf(filters.classSubjectId, 'a.class_subject_id = ?')
    .addIf(filters.classId, 'cs.class_id = ?')
    .addIf(filters.academicYear, 'c.academic_year = ?') // the class's year (API filter, also the dashboards)
    .addIf(filters.semester, 'a.semester = ?')
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

/**
 * What a result counts: every (assessment, student) pair below, the student's score or 0 for a blank one, and
 * the assessment's max score. `assessments_graded` counts the scores actually recorded.
 */
const TOTALS = `COUNT(g.id) AS assessments_graded, SUM(COALESCE(g.score, 0)) AS total_score,
  SUM(a.max_score) AS total_max_score`;

/**
 * The (assessment, student) pairs a result counts, a blank score as 0 (the DepEd class record rule), so a
 * missed exam lowers a result instead of leaving it out: each assessment that has been given (someone in its
 * class-subject has a score for it) with every student on its roster, that is in its class on its date or
 * already graded (rosterStudentIds). An assessment nobody has a score for yet stays out, and so does one dated
 * before a transferee joined the class or after a student left it. `studentIds` limits the pairs to those
 * students inside the roster sub-select, so one student's summary does not build every class's roster.
 * @param {number[] | undefined} studentIds
 * @returns {{ sql: string, params: unknown[] }}
 */
function countedPairs(studentIds) {
  const among = studentIds !== undefined;
  return {
    sql: `FROM assessments a
      ${joinClassSubject('a')}
      CROSS JOIN LATERAL (${rosterStudentIds({ among })}) counted
      JOIN students s ON s.id = counted.student_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN grades g ON g.assessment_id = a.id AND g.student_id = counted.student_id`,
    params: among ? [studentIds, studentIds] : [],
  };
}

/**
 * Points per class-subject (default) or per student and class-subject, split by semester, quarter (term) and
 * assessment type, so the service can grade each quarter with the subject's rules and average the quarters
 * into semesters and the semesters into the school year (utils/grading.js). Built on countedPairs: a blank
 * score counts 0 once its assessment has been given. `studentId` (the API filter) or `studentIds` (several,
 * for the dashboards) limits it to those students; an empty `studentIds` matches nothing.
 */
export async function summarizeGrades(
  { groupBy = 'classSubject', studentId, studentIds, ...filters },
  scope,
) {
  const students = studentIds ?? (studentId === undefined ? undefined : [studentId]);
  if (students?.length === 0) return [];
  const from = countedPairs(students);
  const where = new WhereBuilder()
    .add('EXISTS (SELECT 1 FROM grades given WHERE given.assessment_id = a.id)')
    .addIf(filters.classSubjectId, 'a.class_subject_id = ?')
    .addIf(filters.classId, 'cs.class_id = ?')
    .addIf(filters.academicYear, 'c.academic_year = ?')
    .addIf(filters.semester, 'a.semester = ?')
    .addIf(filters.term, 'a.term = ?')
    .addScope(scope);
  const params = [...from.params, ...where.params];
  if (groupBy === 'student') {
    return query(
      `SELECT s.id AS student_id, CONCAT(u.first_name, ' ', u.last_name) AS label, cs.id AS class_subject_id,
              cs.subject_id, c.academic_year, a.semester, a.term, a.type, ${TOTALS} ${from.sql} ${where.sql}
        GROUP BY s.id, u.first_name, u.last_name, cs.id, cs.subject_id, c.academic_year, a.semester, a.term, a.type
        ORDER BY u.last_name, u.first_name, s.id, cs.id`,
      params,
    );
  }
  return query(
    `SELECT cs.id AS class_subject_id, cs.subject_id, sub.name AS subject_name, c.name AS class_name,
            c.academic_year, CONCAT(c.name, ' - ', sub.name) AS label, a.semester, a.term, a.type, ${TOTALS}
       ${from.sql} ${where.sql}
      GROUP BY cs.id, cs.subject_id, c.name, c.academic_year, sub.name, a.semester, a.term, a.type
      ORDER BY c.academic_year DESC, c.name, sub.name, cs.id`,
    params,
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

/** Map studentId -> `{ score, remarks }` of the recorded grades of these students (before a save). */
export async function findGradesOf(assessmentId, studentIds, conn) {
  const rows = await query(
    'SELECT student_id, score, remarks FROM grades WHERE assessment_id = ? AND student_id IN (?)',
    [assessmentId, studentIds],
    conn,
  );
  return new Map(rows.map((row) => [row.studentId, { score: row.score, remarks: row.remarks }]));
}

export async function deleteGrade(id) {
  return (await run('DELETE FROM grades WHERE id = ?', [id])).affectedRows;
}
