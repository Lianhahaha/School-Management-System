/**
 * SQL for the teachers table (profile) joined with users.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const TEACHER_SORT_MAP = {
  lastName: 'u.last_name',
  firstName: 'u.first_name',
  employeeNumber: 't.employee_number',
  department: 't.department',
  hireDate: 't.hire_date',
  createdAt: 't.created_at',
};

const COLUMNS = `t.id, t.user_id, t.employee_number, u.first_name, u.last_name, u.email, u.phone,
  t.hire_date, t.department, t.qualification, u.is_active, t.created_at, t.updated_at`;

const FROM = 'FROM teachers t JOIN users u ON u.id = t.user_id';

export async function findTeacherById(id, conn) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE t.id = ?`, [id], conn))[0] ?? null;
}

export async function findTeacherByUserId(userId) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE t.user_id = ?`, [userId]))[0] ?? null;
}

export function listTeachers(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, [
      'u.first_name',
      'u.last_name',
      "CONCAT(u.first_name, ' ', u.last_name)",
      't.employee_number',
      't.department',
    ])
    .addIf(listQuery.department, 't.department = ?')
    .addIf(listQuery.isActive, 'u.is_active = ?');
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: TEACHER_SORT_MAP,
    defaultOrder: 'u.last_name ASC, u.first_name ASC',
    tieBreaker: 't.id',
  });
}

export async function insertTeacher(userId, profile, conn) {
  const result = await run(
    'INSERT INTO teachers (user_id, employee_number, hire_date, department, qualification) VALUES (?, ?, ?, ?, ?)',
    [
      userId,
      profile.employeeNumber,
      profile.hireDate,
      profile.department ?? null,
      profile.qualification ?? null,
    ],
    conn,
  );
  return result.insertId;
}

/** Fields of users and teachers that one PATCH can change; the UPDATE joins both tables. */
const PATCH_COLUMNS = {
  firstName: 'u.first_name',
  lastName: 'u.last_name',
  phone: 'u.phone',
  employeeNumber: 't.employee_number',
  hireDate: 't.hire_date',
  department: 't.department',
  qualification: 't.qualification',
};

export async function updateTeacher(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (!set) return;
  await run(
    `UPDATE teachers t JOIN users u ON u.id = t.user_id SET ${set.sql} WHERE t.id = ?`,
    [...set.params, id],
    conn,
  );
}

export async function deleteTeacherByUserId(userId, conn) {
  await run('DELETE FROM teachers WHERE user_id = ?', [userId], conn);
}

/** Highest sequence already issued for EMP-<year>-NNNN, or 0. */
export async function maxEmployeeSequence(year, conn) {
  const rows = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(employee_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM teachers WHERE employee_number LIKE ?`,
    [`EMP-${year}-%`],
    conn,
  );
  return rows[0].maxSeq ?? 0;
}
