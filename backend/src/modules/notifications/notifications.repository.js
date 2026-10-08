/**
 * SQL for in-app notifications. Every read and write is limited to one recipient (user_id).
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder } from '../../utils/sql.js';

export const NOTIFICATION_SORT_MAP = { createdAt: 'n.created_at' };

const COLUMNS = 'n.id, n.type, n.title, n.body, n.link, n.read_at, n.created_at';

/** Inserts `[{ userId, type, title, body, link }]` in one statement. */
export async function insertMany(notes) {
  if (!notes.length) return;
  await run('INSERT INTO notifications (user_id, type, title, body, link) VALUES ?', [
    notes.map((note) => [note.userId, note.type, note.title, note.body ?? null, note.link ?? null]),
  ]);
}

export function listForUser(userId, listQuery) {
  const where = new WhereBuilder().add('n.user_id = ?', userId);
  if (listQuery.unread === true) where.add('n.read_at IS NULL');
  if (listQuery.unread === false) where.add('n.read_at IS NOT NULL');
  return selectPage({
    select: COLUMNS,
    from: 'FROM notifications n',
    where,
    listQuery,
    sortMap: NOTIFICATION_SORT_MAP,
    defaultOrder: 'n.created_at DESC, n.id DESC',
    tieBreaker: 'n.id',
  });
}

export async function countUnread(userId) {
  const rows = await query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [
    userId,
  ]);
  return rows[0].n;
}

/** Marks the user's unread notifications read: the listed ones, or all of them when `ids` is undefined. */
export async function markRead(userId, ids) {
  const where = new WhereBuilder().add('user_id = ? AND read_at IS NULL', userId);
  if (ids) where.add('id IN (?)', ids);
  return (await run(`UPDATE notifications SET read_at = UTC_TIMESTAMP() ${where.sql}`, where.params))
    .affectedRows;
}

export async function deleteForUser(userId, conn) {
  await run('DELETE FROM notifications WHERE user_id = ?', [userId], conn);
}

/** Map studentId -> users.id of the given students. */
export async function findStudentUserIds(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await query('SELECT id, user_id FROM students WHERE id IN (?)', [studentIds]);
  return new Map(rows.map((row) => [row.id, row.userId]));
}

/** users.id of a teacher, or null. */
export async function findTeacherUserId(teacherId) {
  const rows = await query('SELECT user_id FROM teachers WHERE id = ?', [teacherId]);
  return rows[0]?.userId ?? null;
}

export async function findActiveAdminIds() {
  const rows = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
  return rows.map((row) => row.id);
}
