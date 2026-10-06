/**
 * Date helpers. "Today" is always computed in the school's time zone
 * (APP_TIMEZONE), never in the server's local zone, and DATE values are plain
 * 'YYYY-MM-DD' strings end to end.
 */
import { env } from '../config/env.js';
import { ACADEMIC_YEAR_START_MONTH, jsDayToIsoDay } from '../constants/shared.js';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: env.APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: env.APP_TIMEZONE, weekday: 'short' });
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** 'YYYY-MM-DD' for the current instant in APP_TIMEZONE. */
export function todayYmd(now = new Date()) {
  return ymdFormatter.format(now);
}

/** ISO weekday (1 = Monday … 7 = Sunday) for the current instant in APP_TIMEZONE. */
export function todayIsoWeekday(now = new Date()) {
  return jsDayToIsoDay(WEEKDAY_INDEX[weekdayFormatter.format(now)]);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a 'YYYY-MM-DD' date; time-zone independent. */
export function isoWeekdayOf(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return jsDayToIsoDay(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

const dayLabelFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** A 'YYYY-MM-DD' date the way the app shows it, for messages and the activity log: '2026-10-06' -> 'Oct 6, 2026'. */
export function formatDayLabel(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return dayLabelFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

/** True when `ymd` is later than today in APP_TIMEZONE (string comparison works for zero-padded dates). */
export function isAfterToday(ymd, now = new Date()) {
  return ymd > todayYmd(now);
}

/**
 * Academic year label for a date, using the shared start month
 * (ACADEMIC_YEAR_START_MONTH, 8 = August): 2026-10-03 -> '2026-2027',
 * 2027-05-10 -> '2026-2027'.
 */
export function academicYearOf(ymd = todayYmd()) {
  const [year, month] = ymd.split('-').map(Number);
  const start = month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** Current academic year label in APP_TIMEZONE. */
export function currentAcademicYear(now = new Date()) {
  return academicYearOf(todayYmd(now));
}

/** First day ('YYYY-MM-DD') of the given academic year label, e.g. '2026-2027' -> '2026-08-01'. */
export function academicYearStart(label) {
  const start = Number(label.slice(0, 4));
  return `${start}-${String(ACADEMIC_YEAR_START_MONTH).padStart(2, '0')}-01`;
}

/** 'YYYY-MM-DD' plus `days` calendar days (negative allowed); time-zone independent. */
export function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: env.APP_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** How far APP_TIMEZONE's wall clock is ahead of UTC at `instant`, in ms. */
function zoneOffsetMs(instant) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the school day `ymd` begins in APP_TIMEZONE (for filtering DATETIME columns in UTC). */
export function startOfDayUtc(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  // Twice, so a daylight-saving change between the guess and the answer settles.
  let instant = midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc));
  instant = midnightAsUtc - zoneOffsetMs(new Date(instant));
  return new Date(instant);
}

/** Parses an ISO-8601 date-time into a Date truncated to whole seconds (DATETIME columns have no fraction). */
export function parseIsoDateTime(iso) {
  return new Date(Math.floor(new Date(iso).getTime() / 1000) * 1000);
}

/** Current instant truncated to whole seconds. */
export function nowSeconds() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}
