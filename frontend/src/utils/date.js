/**
 * Date helpers. The API speaks 'YYYY-MM-DD' for dates, 'HH:MM' for times and ISO-8601
 * for timestamps. Date-only strings are never passed to `new Date('YYYY-MM-DD')`: that
 * parses as UTC midnight and shows the previous day in time zones west of Greenwich.
 */
import { ACADEMIC_YEAR_START_MONTH, jsDayToIsoDay } from '../constants/shared';

const EMPTY = '—';

/**
 * One locale for every date and time on screen, whatever the browser is set to: Philippine English,
 * so dates read 'Oct 6, 2026' and times '8:00 AM' everywhere. CSV exports keep 'YYYY-MM-DD'.
 */
export const LOCALE = 'en-PH';

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const clockFormatter = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** Largest unit first; the first one that fits is used by relativeTime. */
const RELATIVE_UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const pad = (value) => String(value).padStart(2, '0');

/** '2025-03-14' -> 'Mar 14, 2025'. Empty values render as an em dash. */
export function formatDate(ymd) {
  if (!ymd) return EMPTY;
  const [year, month, day] = ymd.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

/** '2025-03-14' -> 'Mar 14', for chart labels where the year is known. */
export function formatShortDate(ymd) {
  if (!ymd) return EMPTY;
  const [year, month, day] = ymd.split('-').map(Number);
  return shortDateFormatter.format(new Date(year, month - 1, day));
}

/** ISO timestamp -> 'Mar 14, 2025, 9:30 AM' in the viewer's time zone. */
export function formatDateTime(iso) {
  return iso ? dateTimeFormatter.format(new Date(iso)) : EMPTY;
}

/** ISO timestamp -> its time of day, '9:30 AM', in the viewer's time zone. */
export function formatTimeOfDay(iso) {
  return iso ? clockFormatter.format(new Date(iso)) : EMPTY;
}

const clockOf = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes);
};

/** 'HH:MM' or 'HH:MM:SS' (a time of the school day) -> '8:00 AM'. */
export function formatTime(time) {
  return time ? clockFormatter.format(clockOf(time)) : EMPTY;
}

/**
 * The two ends of a period as shown, the first without AM/PM when both share it:
 * ('08:00', '08:50') -> ['8:00', '8:50 AM']; ('11:30', '12:20') -> ['11:30 AM', '12:20 PM'].
 */
export function timeRangeParts(start, end) {
  if (!start || !end) return [formatTime(start), formatTime(end)];
  const dayPeriod = (time) =>
    clockFormatter.formatToParts(clockOf(time)).find((part) => part.type === 'dayPeriod')?.value;
  if (dayPeriod(start) !== dayPeriod(end)) return [formatTime(start), formatTime(end)];
  const startClock = clockFormatter
    .formatToParts(clockOf(start))
    .filter((part) => part.type !== 'dayPeriod')
    .map((part) => part.value)
    .join('')
    .trim();
  return [startClock, formatTime(end)];
}

/** A period's times in one string: '8:00–8:50 AM', or '11:30 AM–12:20 PM' across noon. */
export function formatTimeRange(start, end) {
  return timeRangeParts(start, end).join('–');
}

const toYmd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today as 'YYYY-MM-DD' in the viewer's local time zone (toISOString would give the UTC date). */
export function todayYmd() {
  return toYmd(new Date());
}

/** ISO timestamp -> 'YYYY-MM-DD' of that instant in the viewer's local time zone. */
export function isoToYmd(iso) {
  return toYmd(new Date(iso));
}

/** Today's ISO weekday: 1 = Monday ... 7 = Sunday. */
export function todayIsoWeekday() {
  return jsDayToIsoDay(new Date().getDay());
}

/** The academic year containing today, e.g. '2026-2027' (the year starts in ACADEMIC_YEAR_START_MONTH). */
export function currentAcademicYear() {
  const [year, month] = todayYmd().split('-').map(Number);
  const startYear = month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** 'YYYY-MM-DD' plus `days` calendar days (negative allowed); independent of the time zone. */
export function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** ISO weekday of a 'YYYY-MM-DD' date: 1 = Monday ... 7 = Sunday. */
export function isoWeekdayOf(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return jsDayToIsoDay(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

/** Monday of the week containing a 'YYYY-MM-DD' date. */
export const mondayOf = (ymd) => addDaysYmd(ymd, 1 - isoWeekdayOf(ymd));

/** Last day of an academic year label: '2026-2027' -> '2027-07-31' (the day before the next one starts). */
export function academicYearEnd(label) {
  return addDaysYmd(`${label.slice(5, 9)}-${pad(ACADEMIC_YEAR_START_MONTH)}-01`, -1);
}

/** First day of an academic year label: '2026-2027' -> '2026-08-01' (ACADEMIC_YEAR_START_MONTH). */
export function academicYearStart(label) {
  return `${label.slice(0, 4)}-${pad(ACADEMIC_YEAR_START_MONTH)}-01`;
}

/** True when the ISO timestamp lies within the last `days` days. */
export function isWithinDays(iso, days) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

/** ISO timestamp -> '2 hours ago' / 'in 3 days' / 'just now'. */
export function relativeTime(iso) {
  if (!iso) return EMPTY;
  const diffSeconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const [unit, seconds] = RELATIVE_UNITS.find(([, size]) => Math.abs(diffSeconds) >= size) ?? [];
  return unit ? relativeFormatter.format(Math.round(diffSeconds / seconds), unit) : 'just now';
}

/**
 * `<input type="datetime-local">` value ('2025-03-14T09:30') -> ISO timestamp that keeps the
 * viewer's UTC offset ('2025-03-14T09:30:00+02:00'). Returns null for an empty input.
 */
export function toIsoWithOffset(datetimeLocal) {
  if (!datetimeLocal) return null;
  const offsetMinutes = -new Date(datetimeLocal).getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${datetimeLocal}:00${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/** ISO timestamp -> `<input type="datetime-local">` value in the viewer's time zone ('' when empty). */
export function fromIsoToDatetimeLocal(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
