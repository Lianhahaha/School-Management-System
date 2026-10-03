/** Timetable helpers. Weekdays are ISO numbers (1 = Monday ... 7 = Sunday), times are 'HH:MM'. */
import { DAYS_OF_WEEK } from '../constants/shared';
import { DAY_LABELS, DAY_SHORT_LABELS } from '../constants/ui';

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
