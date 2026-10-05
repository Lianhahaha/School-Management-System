/**
 * SQL for the activity log: append-only rows, read newest first.
 */
import { run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder } from '../../utils/sql.js';

export const ACTIVITY_SORT_MAP = { createdAt: 'al.created_at' };

const COLUMNS = `al.id, al.actor_id, al.actor_name, al.actor_role, al.action, al.area, al.entity_id, al.summary,
  al.details, al.created_at`;

export async function insertEntry(entry) {
  await run(
    `INSERT INTO activity_log (actor_id, actor_name, actor_role, action, area, entity_id, summary, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.actorId,
      entry.actorName,
      entry.actorRole,
      entry.action,
      entry.area,
      entry.entityId ?? null,
      entry.summary,
      entry.details === undefined ? null : JSON.stringify(entry.details),
    ],
  );
}

/**
 * A page of entries. `from` / `to` are instants (the school day boundaries); search matches the summary, the
 * actor's name and the details (names of the students in a grade save, for example).
 */
export function listEntries(listQuery, { from, to }) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['al.summary', 'al.actor_name', 'CAST(al.details AS CHAR)'])
    .addIf(listQuery.area, 'al.area = ?')
    .addIf(listQuery.actorId, 'al.actor_id = ?')
    .addIf(from, 'al.created_at >= ?')
    .addIf(to, 'al.created_at < ?');
  return selectPage({
    select: COLUMNS,
    from: 'FROM activity_log al',
    where,
    listQuery,
    sortMap: ACTIVITY_SORT_MAP,
    defaultOrder: 'al.created_at DESC, al.id DESC',
    tieBreaker: 'al.id',
  });
}
