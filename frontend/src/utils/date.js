/**
 * Date helpers. The API speaks 'YYYY-MM-DD' for dates, 'HH:MM' for times and ISO-8601
 * for timestamps. Date-only strings are never passed to `new Date('YYYY-MM-DD')`: that
 * parses as UTC midnight and shows the previous day in time zones west of Greenwich.
 */
import { ACADEMIC_YEAR_START_MONTH, jsDayToIsoDay } from '../constants/shared';

const EMPTY = '—';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

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

/** '2025-03-14' -> '14 Mar 2025' (locale dependent). Empty values render as an em dash. */
export function formatDate(ymd) {
  if (!ymd) return EMPTY;
  const [year, month, day] = ymd.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

/** ISO timestamp -> '14 Mar 2025, 09:30' in the viewer's time zone. */
export function formatDateTime(iso) {
  return iso ? dateTimeFormatter.format(new Date(iso)) : EMPTY;
}

/** 'HH:MM' or 'HH:MM:SS' -> 'HH:MM'. */
export function formatTime(time) {
  return time ? time.slice(0, 5) : EMPTY;
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
