/**
 * SQL for enrollments: student <-> class membership with history. At most one
 * active row per student is guaranteed by the generated-column unique index.
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

export const findActiveByStudent = (studentId, conn) =>
  findOne(`e.student_id = ? AND e.status = 'active'`, [studentId], conn);

/** Any existing row (open or closed) of this student in this class: UNIQUE(student_id, class_id). */
export const findByStudentAndClass = (studentId, classId, conn) =>
  findOne('e.student_id = ? AND e.class_id = ?', [studentId, classId], conn);

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

/** Re-open a closed row (same student, same class). */
export async function reopenEnrollment(id, enrolledOn, conn) {
  await run(
    `UPDATE enrollments SET status = 'active', enrolled_on = ?, left_on = NULL WHERE id = ?`,
    [enrolledOn, id],
    conn,
  );
}

export async function closeEnrollment(id, status, leftOn, conn) {
  await run(
    `UPDATE enrollments SET status = ?, left_on = ? WHERE id = ? AND status = 'active'`,
    [status, leftOn, id],
    conn,
  );
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

/** `{ id, isActive }` of the students that exist among `ids`. */
export function findStudentsActivity(ids, conn) {
  return query(
    'SELECT s.id, u.is_active FROM students s JOIN users u ON u.id = s.user_id WHERE s.id IN (?)',
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
