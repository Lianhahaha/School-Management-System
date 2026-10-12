import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const SUBJECT_SORT_MAP = { code: 'sub.code', name: 'sub.name', createdAt: 'sub.created_at' };

const COLUMNS =
  'sub.id, sub.code, sub.name, sub.description, sub.is_active, sub.grading_group, sub.created_at, sub.updated_at';
const FROM = 'FROM subjects sub';

/** `forShare` share-locks the subject row until the transaction of `conn` ends. */
export async function findSubjectById(id, conn, { forShare = false } = {}) {
  const lock = forShare ? 'FOR SHARE' : '';
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE sub.id = ? ${lock}`, [id], conn))[0] ?? null;
}

export function listSubjects(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['sub.code', 'sub.name'])
    .addIf(listQuery.isActive, 'sub.is_active = ?');
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: SUBJECT_SORT_MAP,
    defaultOrder: 'sub.code ASC',
    tieBreaker: 'sub.id',
  });
}

export async function insertSubject({ code, name, description, gradingGroup }, conn) {
  const result = await run(
    'INSERT INTO subjects (code, name, description, grading_group) VALUES (?, ?, ?, ?)',
    [code, name, description ?? null, gradingGroup ?? null],
    conn,
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  code: 'code',
  name: 'name',
  description: 'description',
  isActive: 'is_active',
  gradingGroup: 'grading_group',
};

/** Map subjectId -> K-12 grading group of every subject that has one (the table is small). */
export async function findGradingGroups(conn) {
  const rows = await query(
    'SELECT id, grading_group FROM subjects WHERE grading_group IS NOT NULL',
    [],
    conn,
  );
  return new Map(rows.map((row) => [row.id, row.gradingGroup]));
}

export async function updateSubject(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE subjects SET ${set.sql} WHERE id = ?`, [...set.params, id], conn);
}

/** Ids of the subjects class `classId` takes (one class-subject each). */
export async function findSubjectIdsOfClass(classId, conn) {
  const rows = await query('SELECT subject_id FROM class_subjects WHERE class_id = ?', [classId], conn);
  return rows.map((row) => row.subjectId);
}

/**
 * `{ id, name, gradeLevel, academicYear }` of the classes of school year `academicYear` ('2026-2027') or later
 * that take the subject, earliest year and lowest grade first. A locking read (FOR SHARE): inside the caller's
 * transaction it sees assignments committed after its snapshot was taken, and holds them until it ends.
 */
export function findClassesTakingFrom(subjectId, academicYear, conn) {
  return query(
    `SELECT c.id, c.name, c.grade_level, c.academic_year FROM class_subjects cs
       JOIN classes c ON c.id = cs.class_id
      WHERE cs.subject_id = ? AND c.academic_year >= ?
      ORDER BY c.academic_year, c.grade_level, c.name
      FOR SHARE`,
    [subjectId, academicYear],
    conn,
  );
}

/** True when the subject has a grade in a class of a school year before `academicYear` ('2026-2027'). */
export async function hasGradesBefore(subjectId, academicYear, conn) {
  const rows = await query(
    `SELECT 1 AS found FROM grades g
       JOIN assessments a ON a.id = g.assessment_id
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       JOIN classes c ON c.id = cs.class_id
      WHERE cs.subject_id = ? AND c.academic_year < ?
      LIMIT 1`,
    [subjectId, academicYear],
    conn,
  );
  return rows.length > 0;
}

export async function deleteSubject(id, conn) {
  return (await run('DELETE FROM subjects WHERE id = ?', [id], conn)).affectedRows;
}

/**
 * `{ subjectId, assessmentType, weight }` rows of the given subjects, or of every subject when `subjectIds`
 * is null (only types weighted above 0 are stored, so the table stays small).
 */
export async function findGradeWeights(subjectIds, conn) {
  if (subjectIds === null) {
    return query('SELECT subject_id, assessment_type, weight FROM subject_grade_weights', [], conn);
  }
  if (!subjectIds.length) return [];
  return query(
    'SELECT subject_id, assessment_type, weight FROM subject_grade_weights WHERE subject_id IN (?)',
    [subjectIds],
    conn,
  );
}

/** Replaces the subject's weights with `weights` (type -> percent); null or all zero leaves it on points. */
export async function replaceGradeWeights(subjectId, weights, conn) {
  await run('DELETE FROM subject_grade_weights WHERE subject_id = ?', [subjectId], conn);
  const rows = Object.entries(weights ?? {})
    .filter(([, weight]) => weight > 0)
    .map(([type, weight]) => [subjectId, type, weight]);
  if (rows.length) {
    await run(
      'INSERT INTO subject_grade_weights (subject_id, assessment_type, weight) VALUES ?',
      [rows],
      conn,
    );
  }
}
