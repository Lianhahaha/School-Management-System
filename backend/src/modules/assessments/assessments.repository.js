/**
 * SQL for assessments (a graded event of a class-subject). max_score lives here once; grades reference it.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { CLASS_SUBJECT_REF_COLUMNS, WhereBuilder, buildSet, joinClassSubject } from '../../utils/sql.js';

export const ASSESSMENT_SORT_MAP = {
  assessedOn: 'a.assessed_on',
  title: 'a.title',
  type: 'a.type',
  createdAt: 'a.created_at',
};

const COLUMNS = `a.id, a.class_subject_id, ${CLASS_SUBJECT_REF_COLUMNS}, a.title, a.type, a.term, a.max_score,
  a.assessed_on,
  (SELECT COUNT(*) FROM grades g WHERE g.assessment_id = a.id) AS graded_count,
  (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cs.class_id AND e.status = 'active') AS enrolled_count,
  a.created_at, a.updated_at`;

const FROM = `FROM assessments a ${joinClassSubject('a')}`;

export async function findAssessmentById(id, conn) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE a.id = ?`, [id], conn))[0] ?? null;
}

export function listAssessments(listQuery, scope) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['a.title'])
    .addIf(listQuery.classSubjectId, 'a.class_subject_id = ?')
    .addIf(listQuery.classId, 'cs.class_id = ?')
    .addIf(listQuery.type, 'a.type = ?')
    .addIf(listQuery.term, 'a.term = ?')
    .addIf(listQuery.dateFrom, 'a.assessed_on >= ?')
    .addIf(listQuery.dateTo, 'a.assessed_on <= ?')
    .addScope(scope);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: ASSESSMENT_SORT_MAP,
    defaultOrder: 'a.assessed_on DESC',
    tieBreaker: 'a.id',
  });
}

/** Assessments dated within [from, to], soonest first (dashboards). `classId` limits them to one class. */
export function findUpcoming({ classId, from, to, limit }) {
  const where = new WhereBuilder()
    .add('a.assessed_on >= ? AND a.assessed_on <= ?', from, to)
    .addIf(classId, 'cs.class_id = ?');
  return query(
    `SELECT a.id, a.title, a.type, a.assessed_on, c.name AS class_name, sub.name AS subject_name
       ${FROM} ${where.sql} ORDER BY a.assessed_on ASC, a.id ASC LIMIT ${Number(limit)}`,
    where.params,
  );
}

/** The teacher's assessments of an academic year where fewer students are graded than enrolled. */
export function findPendingGrading(teacherId, academicYear, limit) {
  return query(
    `SELECT * FROM (
       SELECT a.id AS assessment_id, a.title, c.name AS class_name, sub.name AS subject_name, a.assessed_on,
              (SELECT COUNT(*) FROM grades g WHERE g.assessment_id = a.id) AS graded,
              (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cs.class_id AND e.status = 'active') AS enrolled
         ${FROM}
        WHERE cs.teacher_id = ? AND c.academic_year = ?
     ) pending
      WHERE graded < enrolled ORDER BY assessed_on DESC LIMIT ${Number(limit)}`,
    [teacherId, academicYear],
  );
}

export async function insertAssessment(data) {
  const result = await run(
    `INSERT INTO assessments (class_subject_id, title, type, term, max_score, assessed_on) VALUES (?, ?, ?, ?, ?, ?)`,
    [data.classSubjectId, data.title, data.type, data.term, data.maxScore, data.assessedOn],
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  title: 'title',
  type: 'type',
  term: 'term',
  maxScore: 'max_score',
  assessedOn: 'assessed_on',
};

export async function updateAssessment(id, fields) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE assessments SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

/** Highest score already recorded for the assessment, or null when ungraded. */
export async function findHighestScore(id) {
  const rows = await query('SELECT MAX(score) AS highest FROM grades WHERE assessment_id = ?', [id]);
  return rows[0].highest;
}

/** Deletes the assessment together with its grades (the grades FK is RESTRICT, so they go first). */
export async function deleteAssessmentWithGrades(id, conn) {
  await run('DELETE FROM grades WHERE assessment_id = ?', [id], conn);
  return (await run('DELETE FROM assessments WHERE id = ?', [id], conn)).affectedRows;
}
