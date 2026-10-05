/**
 * SQL for the school calendar. Dates are inclusive 'YYYY-MM-DD' strings; an event covers day D when
 * starts_on <= D <= ends_on.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const CALENDAR_SORT_MAP = { startsOn: 'ce.starts_on', title: 'ce.title', createdAt: 'ce.created_at' };

const COLUMNS =
  'ce.id, ce.title, ce.description, ce.type, ce.starts_on, ce.ends_on, ce.created_at, ce.updated_at';
const FROM = 'FROM calendar_events ce';

export async function findEventById(id) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE ce.id = ?`, [id]))[0] ?? null;
}

/** Events overlapping [dateFrom, dateTo] (either end optional), earliest first by default. */
export function listEvents(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['ce.title', 'ce.description'])
    .addIf(listQuery.type, 'ce.type = ?')
    .addIf(listQuery.dateFrom, 'ce.ends_on >= ?')
    .addIf(listQuery.dateTo, 'ce.starts_on <= ?');
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: CALENDAR_SORT_MAP,
    defaultOrder: 'ce.starts_on ASC',
    tieBreaker: 'ce.id',
  });
}

/** The first holiday covering `date`, or null. */
export async function findHolidayOn(date) {
  const rows = await query(
    `SELECT ${COLUMNS} ${FROM} WHERE ce.type = 'holiday' AND ce.starts_on <= ? AND ce.ends_on >= ?
      ORDER BY ce.starts_on, ce.id LIMIT 1`,
    [date, date],
  );
  return rows[0] ?? null;
}

/** Events still running or starting within [from, to], soonest first (dashboards). */
export function findUpcoming(from, to, limit) {
  return query(
    `SELECT ${COLUMNS} ${FROM} WHERE ce.ends_on >= ? AND ce.starts_on <= ?
      ORDER BY ce.starts_on, ce.id LIMIT ${Number(limit)}`,
    [from, to],
  );
}

export async function insertEvent({ title, description, type, startsOn, endsOn }) {
  const result = await run(
    'INSERT INTO calendar_events (title, description, type, starts_on, ends_on) VALUES (?, ?, ?, ?, ?)',
    [title, description ?? null, type, startsOn, endsOn],
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  title: 'title',
  description: 'description',
  type: 'type',
  startsOn: 'starts_on',
  endsOn: 'ends_on',
};

export async function updateEvent(id, fields) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE calendar_events SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

export async function deleteEvent(id) {
  return (await run('DELETE FROM calendar_events WHERE id = ?', [id])).affectedRows;
}
