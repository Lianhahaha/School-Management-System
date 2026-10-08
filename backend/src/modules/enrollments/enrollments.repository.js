/**
 * SQL for enrollments: student <-> class membership with history. Rows are
 * only ever inserted and closed, never re-opened; at most one active row per
 * student is guaranteed by the generated-column unique index.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder } from '../../utils/sql.js';

export const ENROLLMENT_SORT_MAP = {
  createdAt: 'e.created_at',
  status: 'e.status',
  enrolledOn: 'e.enrolled_on',
  studentLastName: 'u.last_name',
};

const COLUMNS = `e.id, e.student_id, e.class_id, e.status, e.enrolled_on, e.left_on, e.created_at, e.updated_at,
  s.student_number, u.first_name, u.last_name, c.name AS class_name, c.grade_level, c.academic_year`;

const FROM = `FROM enrollments e
  JOIN students s ON s.id = e.student_id
  JOIN users u ON u.id = s.user_id
  JOIN classes c ON c.id = e.class_id`;

const findOne = async (where, params, conn) =>
  (await query(`SELECT ${COLUMNS} ${FROM} WHERE ${where}`, params, conn))[0] ?? null;

export const findEnrollmentById = (id, conn) => findOne('e.id = ?', [id], conn);

/** The rows with these ids, in the order of `ids` (one query, whatever the batch size). */
export async function findEnrollmentsByIds(ids, conn) {
  if (!ids.length) return [];
  const rows = await query(`SELECT ${COLUMNS} ${FROM} WHERE e.id IN (?)`, [ids], conn);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const findActiveByStudent = (studentId, conn) =>
  findOne(`e.student_id = ? AND e.status = 'active'`, [studentId], conn);

export function listEnrollments(listQuery, scope) {
  const where = new WhereBuilder()
    .addIf(listQuery.studentId, 'e.student_id = ?')
    .addIf(listQuery.classId, 'e.class_id = ?')
    .addIf(listQuery.status, 'e.status = ?')
    .addIf(listQuery.academicYear, 'c.academic_year = ?')
    .addScope(scope);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: ENROLLMENT_SORT_MAP,
    defaultOrder: 'e.created_at DESC',
    tieBreaker: 'e.id',
  });
}

export async function insertEnrollment(studentId, classId, enrolledOn, conn) {
  const result = await run(
    `INSERT INTO enrollments (student_id, class_id, status, enrolled_on) VALUES (?, ?, 'active', ?)`,
    [studentId, classId, enrolledOn],
    conn,
  );
  return result.insertId;
}

/** Closes the row if it is still active; returns the number of rows closed (0 when it was closed meanwhile). */
export async function closeEnrollment(id, status, leftOn, conn) {
  const result = await run(
    `UPDATE enrollments SET status = ?, left_on = ? WHERE id = ? AND status = 'active'`,
    [status, leftOn, id],
    conn,
  );
  return result.affectedRows;
}

/** Close whatever active row the student has; returns the number of rows closed (0 or 1). */
export async function closeActiveByStudent(studentId, status, leftOn, conn) {
  const result = await run(
    `UPDATE enrollments SET status = ?, left_on = ? WHERE student_id = ? AND status = 'active'`,
    [status, leftOn, studentId],
    conn,
  );
  return result.affectedRows;
}

/**
 * `{ id, isActive }` of the students that exist among `ids`. FOR SHARE: a deactivation running at the
 * same time either finishes first (and is seen here) or waits until this transaction ends.
 */
export function findStudentsActivity(ids, conn) {
  return query(
    'SELECT s.id, u.is_active FROM students s JOIN users u ON u.id = s.user_id WHERE s.id IN (?) FOR SHARE OF u',
    [ids],
    conn,
  );
}

export function findActiveByStudents(studentIds, conn) {
  return query(
    `SELECT e.id, e.student_id, e.class_id FROM enrollments e WHERE e.status = 'active' AND e.student_id IN (?)`,
    [studentIds],
    conn,
  );
}
