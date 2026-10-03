import { jsDayToIsoDay } from '../../../constants/shared';
import { formatTime } from '../../../utils/date';
import { dayLabel, timeToMinutes } from '../../../utils/schedule';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

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
