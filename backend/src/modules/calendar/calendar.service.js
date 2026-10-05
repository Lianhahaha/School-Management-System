/**
 * The school calendar: holidays (no classes, so attendance cannot be marked on them) and school events.
 * Everyone reads it; administrators write it.
 */
import { ApiError } from '../../utils/ApiError.js';
import { addDaysYmd, todayYmd } from '../../utils/dates.js';
import { changedList, changesOf, record } from '../activity/activity.service.js';
import * as repo from './calendar.repository.js';

/** Longest entry accepted: a year, which no real holiday or event comes near, so a mistyped year is caught. */
const MAX_DAYS = 366;

const toEventShape = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  type: row.type,
  startsOn: row.startsOn,
  endsOn: row.endsOn,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function assertDates(startsOn, endsOn) {
  const fail = (message, reason) =>
    ApiError.validation(message, undefined, {
      reason,
      issues: [{ path: 'body.endsOn', message }],
    });
  if (endsOn < startsOn) throw fail('endsOn must not be before startsOn', 'invalid_date_range');
  if (endsOn > addDaysYmd(startsOn, MAX_DAYS - 1)) {
    throw fail(`an entry can span at most ${MAX_DAYS} days`, 'date_range_too_long');
  }
}

export async function listEvents(listQuery) {
  const { rows, meta } = await repo.listEvents(listQuery);
  return { data: rows.map(toEventShape), meta };
}

export async function getEvent(id) {
  return toEventShape(ApiError.assertFound(await repo.findEventById(id), 'calendar event', id));
}

/** "Christmas break (no classes, 2026-12-21 to 2027-01-01)" for the activity log. */
const describeEvent = (event) =>
  `${event.title} (${event.type === 'holiday' ? 'no classes' : 'school event'}, ${
    event.endsOn === event.startsOn ? event.startsOn : `${event.startsOn} to ${event.endsOn}`
  })`;

const eventFields = ({ title, type, startsOn, endsOn }) => ({ title, type, startsOn, endsOn });

export async function createEvent(body) {
  const endsOn = body.endsOn ?? body.startsOn;
  assertDates(body.startsOn, endsOn);
  const event = await getEvent(await repo.insertEvent({ ...body, endsOn }));
  await record({
    action: 'calendar.create',
    entityId: event.id,
    summary: `Added ${describeEvent(event)} to the calendar`,
    details: eventFields(event),
  });
  return event;
}

export async function updateEvent(id, patch) {
  const existing = await getEvent(id);
  assertDates(patch.startsOn ?? existing.startsOn, patch.endsOn ?? existing.endsOn);
  await repo.updateEvent(id, patch);
  const event = await getEvent(id);
  const changes = changesOf(existing, patch);
  if (changes) {
    await record({
      action: 'calendar.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of ${describeEvent(event)}`,
      details: { changes },
    });
  }
  return event;
}

export async function deleteEvent(id) {
  const existing = await repo.findEventById(id);
  if (!(await repo.deleteEvent(id))) throw ApiError.notFound('calendar event', id);
  await record({
    action: 'calendar.delete',
    entityId: id,
    summary: `Removed ${describeEvent(existing)} from the calendar`,
    details: eventFields(existing),
  });
  return { id };
}

/** `{ id, title }` of the holiday on `date`, or null when classes run (attendance sheets). */
export async function holidayOn(date) {
  const holiday = await repo.findHolidayOn(date);
  return holiday ? { id: holiday.id, title: holiday.title } : null;
}

/** 400 when `date` is a school holiday: no lessons, so no attendance. */
export async function assertSchoolDay(date) {
  const holiday = await holidayOn(date);
  if (holiday) {
    throw ApiError.validation(`no classes on ${date}: ${holiday.title}`, undefined, {
      reason: 'school_holiday',
      eventId: holiday.id,
    });
  }
}

/** Entries running today or starting within `days`, soonest first (dashboards; everyone may read them). */
export async function upcomingEvents({ days = 30, limit = 5 } = {}) {
  const today = todayYmd();
  return (await repo.findUpcoming(today, addDaysYmd(today, days), limit)).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }));
}
