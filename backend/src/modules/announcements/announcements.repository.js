/**
 * SQL for announcements. Status is computed from published_at / expires_at in UTC.
 */
import { query, run } from '../../config/db.js';
import { ANNOUNCEMENT_AUDIENCES } from '../../constants/shared.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

// Positional: the order is pinned to the ENUM in schema.sql by `npm run check:constants`.
const [AUDIENCE_ALL, AUDIENCE_STUDENTS, AUDIENCE_TEACHERS] = ANNOUNCEMENT_AUDIENCES;

export const ANNOUNCEMENT_SORT_MAP = {
  publishedAt: 'a.published_at',
  title: 'a.title',
  createdAt: 'a.created_at',
};

/** Published and not expired. */
const ACTIVE_SQL = `(a.published_at <= UTC_TIMESTAMP() AND (a.expires_at IS NULL OR a.expires_at > UTC_TIMESTAMP()))`;

export const STATUS_SQL = `(CASE WHEN a.published_at > UTC_TIMESTAMP() THEN 'scheduled'
  WHEN a.expires_at IS NOT NULL AND a.expires_at <= UTC_TIMESTAMP() THEN 'expired' ELSE 'active' END)`;

/**
 * Visibility scope of a teacher: active school-wide notices for everyone or for teachers, active notices
 * of the classes in `visibleClass` (access.classScope on a.class_id), and everything they authored.
 */
export const teacherVisibility = (visibleClass, authorId) => ({
  sql: `((${ACTIVE_SQL} AND ((a.class_id IS NULL AND a.audience IN (?, ?)) OR ${visibleClass.sql}))
         OR a.author_id = ?)`,
  params: [AUDIENCE_ALL, AUDIENCE_TEACHERS, ...visibleClass.params, authorId],
});

/** Visibility scope of a student: active notices for everyone or for students, school-wide or for their class. */
export const studentVisibility = (activeClassId) => ({
  sql: `(${ACTIVE_SQL} AND a.audience IN (?, ?) AND (a.class_id IS NULL OR a.class_id = ?))`,
  params: [AUDIENCE_ALL, AUDIENCE_STUDENTS, activeClassId ?? 0],
});

const COLUMNS = `a.id, a.author_id, au.first_name AS author_first_name, au.last_name AS author_last_name,
  au.role AS author_role, a.title, a.body, a.audience, a.class_id, c.name AS class_name,
  a.published_at, a.expires_at, ${STATUS_SQL} AS status, a.created_at, a.updated_at`;

const FROM = `FROM announcements a
  JOIN users au ON au.id = a.author_id
  LEFT JOIN classes c ON c.id = a.class_id`;

/** @param {{ sql: string, params: unknown[] } | null} scope visibility fragment of the caller (null = admin) */
export async function findAnnouncementById(id, scope = null) {
  const where = new WhereBuilder().add('a.id = ?', id).addScope(scope);
  return (await query(`SELECT ${COLUMNS} ${FROM} ${where.sql}`, where.params))[0] ?? null;
}

export function listAnnouncements(listQuery, scope) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['a.title', 'a.body'])
    .addIf(listQuery.audience, 'a.audience = ?')
    .addIf(listQuery.classId, 'a.class_id = ?')
    .addIf(listQuery.authorId, 'a.author_id = ?')
    .addScope(scope);
  if (listQuery.status && listQuery.status !== 'all') where.add(`${STATUS_SQL} = ?`, listQuery.status);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: ANNOUNCEMENT_SORT_MAP,
    defaultOrder: 'a.published_at DESC',
    tieBreaker: 'a.id',
  });
}

/** Newest active announcements the caller may see (dashboards). */
export function findRecentActive(scope, limit) {
  const where = new WhereBuilder().add(ACTIVE_SQL).addScope(scope);
  return query(
    `SELECT ${COLUMNS} ${FROM} ${where.sql} ORDER BY a.published_at DESC, a.id DESC LIMIT ${Number(limit)}`,
    where.params,
  );
}

export async function insertAnnouncement(data) {
  const result = await run(
    `INSERT INTO announcements (author_id, title, body, audience, class_id, published_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.authorId,
      data.title,
      data.body,
      data.audience,
      data.classId ?? null,
      data.publishedAt,
      data.expiresAt ?? null,
    ],
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  title: 'title',
  body: 'body',
  audience: 'audience',
  classId: 'class_id',
  publishedAt: 'published_at',
  expiresAt: 'expires_at',
};

export async function updateAnnouncement(id, fields) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE announcements SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

export async function deleteAnnouncement(id) {
  return (await run('DELETE FROM announcements WHERE id = ?', [id])).affectedRows;
}
