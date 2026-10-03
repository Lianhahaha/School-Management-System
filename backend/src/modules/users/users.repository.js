/**
 * SQL for the users table (identity row of every account) and the per-request auth lookup.
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

export function listUsers(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['u.first_name', 'u.last_name', 'u.email'])
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

/** Point an existing users row at a (new) Firebase account; used by the seed after a Firebase project change. */
export async function relinkFirebaseUid(id, firebaseUid, conn) {
  await run('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUid, id], conn);
}
