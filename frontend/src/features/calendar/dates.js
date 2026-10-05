/**
 * Date helpers of the calendar views. Days are 'YYYY-MM-DD' strings and months 'YYYY-MM'; entries are
 * inclusive ranges `{ startsOn, endsOn }`.
 */
import { addDaysYmd, formatDate, mondayOf } from '../../utils/date';

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

/** 'YYYY-MM' moved by `delta` months. */
export function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** '2026-10' -> 'October 2026' (locale dependent). */
export function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthFormatter.format(new Date(year, monthNumber - 1, 1));
}

/** Every day the month grid shows: whole weeks, Monday first, around `month`. */
export function monthGridDays(month) {
  const last = addDaysYmd(`${shiftMonth(month, 1)}-01`, -1);
  const days = [];
  for (let day = mondayOf(`${month}-01`); day <= addDaysYmd(mondayOf(last), 6); day = addDaysYmd(day, 1)) {
    days.push(day);
  }
  return days;
}

/** True when the entry runs on `day`. */
export const coversDay = (event, day) => event.startsOn <= day && event.endsOn >= day;

/** '14 Mar 2026' for one day, '21 Dec 2026 – 01 Jan 2027' for a range. */
export const formatEventDates = (event) =>
  event.endsOn === event.startsOn
    ? formatDate(event.startsOn)
    : `${formatDate(event.startsOn)} – ${formatDate(event.endsOn)}`;
