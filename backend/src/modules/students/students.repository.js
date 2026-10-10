/**
 * SQL for the students table (profile) joined with users and the active enrollment.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const STUDENT_SORT_MAP = {
  lastName: 'u.last_name',
  firstName: 'u.first_name',
  studentNumber: 's.student_number',
  admissionDate: 's.admission_date',
  createdAt: 's.created_at',
};

const COLUMNS = `s.id, s.user_id, s.student_number, s.lrn, u.first_name, u.last_name, u.email, u.phone,
  s.date_of_birth, s.gender, s.address, s.guardian_name, s.guardian_phone, s.admission_date, u.is_active,
  s.created_at, s.updated_at,
  e.id AS enrollment_id, e.class_id, e.status AS enrollment_status, e.enrolled_on,
  c.name AS class_name, c.grade_level, c.academic_year`;

const FROM = `FROM students s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
  LEFT JOIN classes c ON c.id = e.class_id`;

export async function findStudentById(id) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE s.id = ?`, [id]))[0] ?? null;
}

export async function findStudentByUserId(userId) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE s.user_id = ?`, [userId]))[0] ?? null;
}

/** @param {{ sql: string, params: unknown[] } | null} scope extra WHERE fragment (teacher visibility) or null */
export function listStudents(listQuery, scope) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, [
      'u.first_name',
      'u.last_name',
      "CONCAT(u.first_name, ' ', u.last_name)",
      's.student_number',
      's.lrn',
      'u.email',
    ])
    .addIf(listQuery.classId, 'e.class_id = ?')
    .addIf(listQuery.gradeLevel, 'c.grade_level = ?')
    .addIf(listQuery.gender, 's.gender = ?')
    .addIf(listQuery.isActive, 'u.is_active = ?')
    .addScope(scope);
  if (listQuery.hasActiveEnrollment !== undefined) {
    where.add(listQuery.hasActiveEnrollment ? 'e.id IS NOT NULL' : 'e.id IS NULL');
  }
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: STUDENT_SORT_MAP,
    defaultOrder: 'u.last_name ASC, u.first_name ASC',
    tieBreaker: 's.id',
  });
}

export async function insertStudent(userId, profile, conn) {
  const result = await run(
    `INSERT INTO students (user_id, student_number, lrn, date_of_birth, gender, address, guardian_name, guardian_phone, admission_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      profile.studentNumber,
      profile.lrn ?? null,
      profile.dateOfBirth ?? null,
      profile.gender ?? null,
      profile.address ?? null,
      profile.guardianName ?? null,
      profile.guardianPhone ?? null,
      profile.admissionDate,
    ],
    conn,
  );
  return result.insertId;
}

/** Fields of users and students that one PATCH can change; the UPDATE joins both tables. */
const PATCH_COLUMNS = {
  firstName: 'u.first_name',
  lastName: 'u.last_name',
  phone: 'u.phone',
  studentNumber: 's.student_number',
  lrn: 's.lrn',
  dateOfBirth: 's.date_of_birth',
  gender: 's.gender',
  address: 's.address',
  guardianName: 's.guardian_name',
  guardianPhone: 's.guardian_phone',
  admissionDate: 's.admission_date',
};

export async function updateStudent(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (!set) return;
  await run(
    `UPDATE students s JOIN users u ON u.id = s.user_id SET ${set.sql} WHERE s.id = ?`,
    [...set.params, id],
    conn,
  );
}

export async function deleteStudentByUserId(userId, conn) {
  await run('DELETE FROM students WHERE user_id = ?', [userId], conn);
}

/** Highest sequence already issued for STU-<year>-NNNN, or 0. */
export async function maxStudentSequence(year, conn) {
  const rows = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(student_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM students WHERE student_number LIKE ?`,
    [`STU-${year}-%`],
    conn,
  );
  return rows[0].maxSeq ?? 0;
}
