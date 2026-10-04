/** Timetable helpers. Weekdays are ISO numbers (1 = Monday ... 7 = Sunday), times are 'HH:MM'. */
import { DAYS_OF_WEEK, jsDayToIsoDay } from '../constants/shared';
import { DAY_LABELS, DAY_SHORT_LABELS } from '../constants/ui';
import { formatTime } from './date';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/**
 * 1 -> 'Monday' (or 'Mon' with `short`).
 * @param {number} day ISO weekday
 * @param {{ short?: boolean }} [options]
 */
export function dayLabel(day, { short = false } = {}) {
  return (short ? DAY_SHORT_LABELS : DAY_LABELS)[day] ?? String(day);
}

/** 'HH:MM' (or 'HH:MM:SS') -> minutes since midnight, for sorting and for sizing timetable cells. */
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Buckets schedule slots by weekday and sorts each bucket by start time.
 * Always returns the seven days in order, so a timetable can show Monday to Friday and add the
 * weekend only when Saturday or Sunday has slots.
 * @param {Array<{ dayOfWeek: number, startTime: string }>} slots
 * @returns {Array<{ day: number, slots: object[] }>}
 */
export function slotsToGrid(slots) {
  return DAYS_OF_WEEK.map((day) => ({
    day,
    slots: slots
      .filter((slot) => slot.dayOfWeek === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
  }));
}

/**
 * The slot that starts next (this week or the start of next week) among `slots`, or null.
 * A slot that started earlier today counts for next week.
 *
 * @param {Array<{ dayOfWeek: number, startTime: string }>} slots timetable slots, any order
 * @param {Date} [now]
 */
export function nextPeriodOf(slots, now = new Date()) {
  const nowMinutes =
    (jsDayToIsoDay(now.getDay()) - 1) * MINUTES_PER_DAY + now.getHours() * 60 + now.getMinutes();
  let best = null;
  let bestWait = Infinity;
  for (const slot of slots) {
    const start = (slot.dayOfWeek - 1) * MINUTES_PER_DAY + timeToMinutes(slot.startTime);
    const wait = (start - nowMinutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (wait < bestWait) {
      best = slot;
      bestWait = wait;
    }
  }
  return best;
}

/** 'Tue 10:00 · B-204' (the room only when there is one). */
export function formatPeriod(slot) {
  const when = `${dayLabel(slot.dayOfWeek, { short: true })} ${formatTime(slot.startTime)}`;
  return slot.room ? `${when} · ${slot.room}` : when;
}
