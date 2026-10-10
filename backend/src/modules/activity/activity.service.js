/**
 * The activity log: who changed what and when. Services call `record` after a change succeeded; the actor is
 * the signed-in user of the request (utils/requestContext), or "System" outside a request (the seed script).
 *
 * Recording is best effort on purpose: the change has already happened, so a failed log write is reported in
 * the server log and never turns a successful request into an error.
 *
 * An action is `<record type>.<verb>` (grades.save, enrollment.transfer); its area (the list's filter) follows
 * from the record type.
 */
import { addDaysYmd, startOfDayUtc } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';
import { currentUser } from '../../utils/requestContext.js';
import * as repo from './activity.repository.js';

/** Record type (the action's prefix) -> area of ACTIVITY_AREAS. */
const AREA_OF = {
  user: 'accounts',
  student: 'accounts',
  teacher: 'accounts',
  enrollment: 'enrollments',
  class: 'classes',
  assignment: 'classes',
  subject: 'subjects',
  schedule: 'timetable',
  attendance: 'attendance',
  assessment: 'grades',
  grades: 'grades',
  announcement: 'announcements',
  calendar: 'calendar',
};

/** "First Last" of anything with firstName / lastName. */
export const nameOf = (person) => `${person.firstName} ${person.lastName}`;

/**
 * `{ field: { from, to } }` for every field of `patch` whose value differs from `before` (compared as JSON,
 * so objects such as grade weights compare by content), or null when nothing changed.
 */
export function changesOf(before, patch) {
  const changes = {};
  for (const [field, to] of Object.entries(patch)) {
    const from = before[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to ?? null)) changes[field] = { from, to: to ?? null };
  }
  return Object.keys(changes).length ? changes : null;
}

/** Field names a summary spells out rather than splitting at capitals. */
const FIELD_WORDS = { lrn: 'LRN' };

/** "phone and guardian phone" from changes keyed by camelCase field names, for summaries. */
export function changedList(changes) {
  const words = Object.keys(changes).map(
    (field) => FIELD_WORDS[field] ?? field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`),
  );
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0];
}

/**
 * Adds an entry. Never throws.
 *
 * @param {object} entry
 * @param {string} entry.action e.g. 'grades.save'
 * @param {number} [entry.entityId] id of the record the action names
 * @param {string} entry.summary one readable line, at most 255 characters
 * @param {object} [entry.details] before / after values and names
 * @param {{ id: number, firstName: string, lastName: string, role: string }} [entry.actor] defaults to the
 *   request's user (pass it when there is none, for example the account a self-registration created)
 */
export async function record({ action, entityId, summary, details, actor = currentUser() }) {
  // Cut by whole characters (code points), as the column counts them, so an emoji is never split in two.
  const chars = [...summary];
  const fittedSummary = chars.length > 255 ? `${chars.slice(0, 254).join('')}…` : summary;
  try {
    await repo.insertEntry({
      actorId: actor?.id ?? null,
      actorName: actor ? nameOf(actor) : 'System',
      actorRole: actor?.role ?? null,
      action,
      area: AREA_OF[action.split('.')[0]],
      entityId,
      summary: fittedSummary,
      details,
    });
  } catch (error) {
    logger.error('could not write the activity log', { action, entityId, error: String(error) });
  }
}

const toEntryShape = (row) => ({
  id: row.id,
  actor: row.actorId === null ? null : { id: row.actorId, name: row.actorName, role: row.actorRole },
  actorName: row.actorName,
  action: row.action,
  area: row.area,
  entityId: row.entityId,
  summary: row.summary,
  details: row.details,
  createdAt: row.createdAt,
});

/** dateFrom / dateTo are school days (APP_TIMEZONE), both inclusive. */
export async function listActivity(listQuery) {
  const range = {
    from: listQuery.dateFrom ? startOfDayUtc(listQuery.dateFrom) : undefined,
    to: listQuery.dateTo ? startOfDayUtc(addDaysYmd(listQuery.dateTo, 1)) : undefined,
  };
  const { rows, meta } = await repo.listEntries(listQuery, range);
  return { data: rows.map(toEntryShape), meta };
}
