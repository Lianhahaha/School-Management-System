import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const CLASS_SORT_MAP = {
  name: 'c.name',
  gradeLevel: 'c.grade_level',
  academicYear: 'c.academic_year',
  createdAt: 'c.created_at',
};

const COLUMNS = `c.id, c.name, c.grade_level, c.academic_year, c.homeroom_teacher_id,
  hu.first_name AS homeroom_first_name, hu.last_name AS homeroom_last_name,
  (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status = 'active') AS student_count,
  c.created_at, c.updated_at`;

const FROM = `FROM classes c
  LEFT JOIN teachers ht ON ht.id = c.homeroom_teacher_id
  LEFT JOIN users hu ON hu.id = ht.user_id`;

/** `forUpdate` (or `forShare`) locks the class row (only that row) until the transaction ends. */
export async function findClassById(id, conn, { forUpdate = false, forShare = false } = {}) {
  const lock = forUpdate ? 'FOR UPDATE OF c' : forShare ? 'FOR SHARE OF c' : '';
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE c.id = ? ${lock}`, [id], conn))[0] ?? null;
}

/**
 * True when students are or were enrolled in the class, or a subject is assigned to it. Timetable slots,
 * attendance and assessments all hang off an assignment, so they are covered by the second check. Locking
 * reads (FOR SHARE): inside the caller's transaction they see rows committed after its snapshot was taken.
 */
export async function classHasDependents(id, conn) {
  for (const table of ['enrollments', 'class_subjects']) {
    const rows = await query(`SELECT 1 AS ok FROM ${table} WHERE class_id = ? LIMIT 1 FOR SHARE`, [id], conn);
    if (rows.length) return true;
  }
  return false;
}

/** Every class (section) of one grade level in one academic year, by name. */
export function findClassesOfGrade(academicYear, gradeLevel) {
  return query(`SELECT ${COLUMNS} ${FROM} WHERE c.academic_year = ? AND c.grade_level = ? ORDER BY c.name`, [
    academicYear,
    gradeLevel,
  ]);
}

/**
 * Ids of every class of one grade level in one academic year, row-locked (in id order, so two callers cannot
 * deadlock) until `conn`'s transaction ends.
 */
export async function lockClassIdsOfGrade(academicYear, gradeLevel, conn) {
  const rows = await query(
    'SELECT id FROM classes WHERE academic_year = ? AND grade_level = ? ORDER BY id FOR UPDATE',
    [academicYear, gradeLevel],
    conn,
  );
  return rows.map((row) => row.id);
}

/** @param {{ sql: string, params: unknown[] } | null} scope class scope on c.id (null = every class) */
export function listClasses(listQuery, scope = null) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['c.name'])
    .addIf(listQuery.academicYear, 'c.academic_year = ?')
    .addIf(listQuery.gradeLevel, 'c.grade_level = ?')
    .addIf(listQuery.homeroomTeacherId, 'c.homeroom_teacher_id = ?')
    .addScope(scope);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: CLASS_SORT_MAP,
    defaultOrder: 'c.academic_year DESC, c.name ASC',
    tieBreaker: 'c.id',
  });
}

export async function insertClass({ name, gradeLevel, academicYear, homeroomTeacherId }, conn) {
  const result = await run(
    'INSERT INTO classes (name, grade_level, academic_year, homeroom_teacher_id) VALUES (?, ?, ?, ?)',
    [name, gradeLevel, academicYear, homeroomTeacherId ?? null],
    conn,
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  name: 'name',
  gradeLevel: 'grade_level',
  academicYear: 'academic_year',
  homeroomTeacherId: 'homeroom_teacher_id',
};

export async function updateClass(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE classes SET ${set.sql} WHERE id = ?`, [...set.params, id], conn);
}

export async function deleteClass(id) {
  return (await run('DELETE FROM classes WHERE id = ?', [id])).affectedRows;
}
