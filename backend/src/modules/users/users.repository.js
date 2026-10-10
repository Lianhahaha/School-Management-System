/**
 * SQL for the users table (identity row of every account), the per-request auth lookup and the
 * "is anything still pointing at this account" check before a delete.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const USER_SORT_MAP = {
  lastName: 'u.last_name',
  firstName: 'u.first_name',
  email: 'u.email',
  role: 'u.role',
  createdAt: 'u.created_at',
};

const COLUMNS = `u.id, u.firebase_uid, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active,
  u.created_at, u.updated_at`;

/** One query per request: identity, role, profile ids and the class of the active enrollment. */
export async function findAuthContextByFirebaseUid(firebaseUid) {
  const rows = await query(
    `SELECT u.id, u.firebase_uid, u.email, u.first_name, u.last_name, u.role, u.is_active,
            s.id AS student_id, t.id AS teacher_id, e.class_id AS active_class_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN teachers t ON t.user_id = u.id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
      WHERE u.firebase_uid = ?`,
    [firebaseUid],
  );
  return rows[0] ?? null;
}

export async function findUserById(id, conn) {
  return (await query(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`, [id], conn))[0] ?? null;
}

export async function findUserByEmail(email, conn) {
  return (await query(`SELECT ${COLUMNS} FROM users u WHERE u.email = ?`, [email], conn))[0] ?? null;
}

export async function findUserByFirebaseUid(firebaseUid, conn) {
  return (
    (await query(`SELECT ${COLUMNS} FROM users u WHERE u.firebase_uid = ?`, [firebaseUid], conn))[0] ?? null
  );
}

/** Row-locks the account until `conn`'s transaction ends (status changes and the checks that guard them). */
export async function lockUser(id, conn) {
  await query('SELECT id FROM users WHERE id = ? FOR UPDATE', [id], conn);
}

export function listUsers(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, [
      'u.first_name',
      'u.last_name',
      "CONCAT(u.first_name, ' ', u.last_name)",
      'u.email',
    ])
    .addIf(listQuery.role, 'u.role = ?')
    .addIf(listQuery.isActive, 'u.is_active = ?');
  return selectPage({
    select: COLUMNS,
    from: 'FROM users u',
    where,
    listQuery,
    sortMap: USER_SORT_MAP,
    defaultOrder: 'u.last_name ASC, u.first_name ASC',
    tieBreaker: 'u.id',
  });
}

export async function insertUser({ firebaseUid, email, firstName, lastName, phone, role }, conn) {
  const result = await run(
    'INSERT INTO users (firebase_uid, email, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
    [firebaseUid, email, firstName, lastName, phone ?? null, role],
    conn,
  );
  return result.insertId;
}

const PATCH_COLUMNS = { firstName: 'first_name', lastName: 'last_name', phone: 'phone' };

export async function updateUser(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE users SET ${set.sql} WHERE id = ?`, [...set.params, id], conn);
}

export async function setActive(id, isActive, conn) {
  await run('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id], conn);
}

/**
 * Ids of the active admins, row-locked until `conn`'s transaction ends, so two "last admin" checks
 * cannot pass side by side. Only primary-key records are locked (candidates from a plain read,
 * re-checked under the lock). Any lock in idx_users_role_active, including the gap locks of a scan
 * through it, which the optimizer picks on a small table unless forced, would deadlock the caller's
 * own UPDATE of is_active with a concurrent caller waiting there.
 */
export async function lockActiveAdminIds(conn) {
  const candidates = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1", [], conn);
  if (!candidates.length) return [];
  const locked = await query(
    'SELECT id FROM users FORCE INDEX (PRIMARY) WHERE id IN (?) AND is_active = 1 FOR UPDATE',
    [candidates.map((row) => row.id)],
    conn,
  );
  return locked.map((row) => row.id);
}

/**
 * True when any record points at the account or its role profile: announcements it wrote, attendance
 * it marked, grades it entered, payments it recorded, a student's enrollments, attendance, grades and
 * payments, or a teacher's class-subject assignments (with their timetable and assessments) and homeroom
 * classes.
 */
export async function hasHistory(id, conn) {
  const rows = await query(
    `SELECT (
          EXISTS (SELECT 1 FROM announcements an WHERE an.author_id = ?)
       OR EXISTS (SELECT 1 FROM attendance att WHERE att.marked_by = ?)
       OR EXISTS (SELECT 1 FROM grades g WHERE g.graded_by = ?)
       OR EXISTS (SELECT 1 FROM payments p WHERE p.recorded_by = ?)
       OR EXISTS (SELECT 1 FROM students s JOIN enrollments e ON e.student_id = s.id WHERE s.user_id = ?)
       OR EXISTS (SELECT 1 FROM students s JOIN attendance att ON att.student_id = s.id WHERE s.user_id = ?)
       OR EXISTS (SELECT 1 FROM students s JOIN grades g ON g.student_id = s.id WHERE s.user_id = ?)
       OR EXISTS (SELECT 1 FROM students s JOIN payments p ON p.student_id = s.id WHERE s.user_id = ?)
       OR EXISTS (SELECT 1 FROM teachers t JOIN class_subjects cs ON cs.teacher_id = t.id WHERE t.user_id = ?)
       OR EXISTS (SELECT 1 FROM teachers t JOIN classes c ON c.homeroom_teacher_id = t.id WHERE t.user_id = ?)
     ) AS has_history`,
    Array(10).fill(id),
    conn,
  );
  return Boolean(rows[0].hasHistory);
}

/** Deletes the users row; returns false when it no longer exists. The role profile must be deleted first. */
export async function deleteUser(id, conn) {
  return (await run('DELETE FROM users WHERE id = ?', [id], conn)).affectedRows > 0;
}

/** Point an existing users row at a (new) Firebase account; used by the seed after a Firebase project change. */
export async function relinkFirebaseUid(id, firebaseUid, conn) {
  await run('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUid, id], conn);
}
