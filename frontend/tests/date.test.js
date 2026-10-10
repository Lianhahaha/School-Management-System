import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  academicYearEnd,
  academicYearMonths,
  academicYearStart,
  addDaysYmd,
  ageOn,
  currentAcademicYear,
  formatDate,
  formatTimeRange,
  fromIsoToDatetimeLocal,
  isoToYmd,
  isoWeekdayOf,
  isWithinDays,
  mondayOf,
  relativeTime,
  timeRangeParts,
  todayIsoWeekday,
  todayYmd,
  toIsoWithOffset,
} from '../src/utils/date';

/** Formatted times may hold a narrow no-break space before AM/PM, depending on the ICU version. */
const plain = (text) => text.replace(/\s/g, ' ');

afterEach(() => {
  vi.useRealTimers();
});

it('runs in the time zone vitest.config.js sets (UTC+8)', () => {
  expect(new Date(2026, 9, 10).getTimezoneOffset()).toBe(-480);
});

describe('calendar arithmetic on YYYY-MM-DD', () => {
  it.each([
    ['2026-10-10', 1, '2026-10-11'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-10-10', 0, '2026-10-10'],
    ['2026-10-10', 365, '2027-10-10'],
  ])('%s plus %i days is %s', (ymd, days, expected) => {
    expect(addDaysYmd(ymd, days)).toBe(expected);
  });

  it('numbers weekdays the ISO way, Monday 1 to Sunday 7', () => {
    expect(isoWeekdayOf('2026-10-12')).toBe(1);
    expect(isoWeekdayOf('2026-10-10')).toBe(6);
    expect(isoWeekdayOf('2026-10-11')).toBe(7);
    expect(isoWeekdayOf('2028-02-29')).toBe(2);
  });

  it('finds the Monday of a week, a Sunday belonging to the week before it', () => {
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2027-01-03')).toBe('2026-12-28');
  });

  it('starts an academic year on 1 August and ends it on 31 July', () => {
    expect(academicYearStart('2026-2027')).toBe('2026-08-01');
    expect(academicYearEnd('2026-2027')).toBe('2027-07-31');
    expect(academicYearEnd('2027-2028')).toBe('2028-07-31');
  });

  it('lists the twelve months of an academic year with their first and last day', () => {
    const months = academicYearMonths('2027-2028');
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({
      value: '2027-08',
      label: 'August 2027',
      dateFrom: '2027-08-01',
      dateTo: '2027-08-31',
    });
    expect(months.find((month) => month.value === '2028-02')).toMatchObject({ dateTo: '2028-02-29' });
    expect(months.at(-1)).toMatchObject({ value: '2028-07', dateFrom: '2028-07-01', dateTo: '2028-07-31' });
  });

  it('counts an age in whole years, a birthday on the day included', () => {
    expect(ageOn('2012-08-01', '2026-08-01')).toBe(14);
    expect(ageOn('2012-08-02', '2026-08-01')).toBe(13);
    expect(ageOn('2012-12-31', '2026-08-01')).toBe(13);
    expect(ageOn('2012-01-15', '2026-08-01')).toBe(14);
    expect(ageOn(null, '2026-08-01')).toBeNull();
  });
});

describe('today and the current academic year', () => {
  it('turns the academic year over at midnight on 1 August, local time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59, 59));
    expect(currentAcademicYear()).toBe('2025-2026');
    vi.setSystemTime(new Date(2026, 7, 1, 0, 0, 0));
    expect(currentAcademicYear()).toBe('2026-2027');
    vi.setSystemTime(new Date(2027, 0, 15));
    expect(currentAcademicYear()).toBe('2026-2027');
  });

  it('gives the local date, not the UTC one', () => {
    vi.useFakeTimers();
    // 20:00 UTC on 9 October is 04:00 on 10 October in Manila; toISOString would say the 9th.
    vi.setSystemTime(new Date('2026-10-09T20:00:00Z'));
    expect(todayYmd()).toBe('2026-10-10');
    expect(todayIsoWeekday()).toBe(6);
    expect(isoToYmd('2026-10-09T15:59:59Z')).toBe('2026-10-09');
    expect(isoToYmd('2026-10-09T16:00:00Z')).toBe('2026-10-10');
  });

  it('counts a timestamp exactly the given days old as within them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    expect(isWithinDays('2026-10-03T00:00:00Z', 7)).toBe(true);
    expect(isWithinDays('2026-10-02T23:59:59Z', 7)).toBe(false);
    expect(isWithinDays(null, 7)).toBe(false);
  });

  it('describes a timestamp relative to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    expect(relativeTime('2026-10-10T11:59:30Z')).toBe('just now');
    expect(relativeTime('2026-10-10T10:00:00Z')).toBe('2 hours ago');
    expect(relativeTime('2026-10-09T12:00:00Z')).toBe('yesterday');
    expect(relativeTime('2026-10-13T12:00:00Z')).toBe('in 3 days');
    expect(relativeTime(null)).toBe('—');
  });
});

describe('datetime-local inputs', () => {
  it("keeps the viewer's UTC offset when sending a datetime-local value", () => {
    expect(toIsoWithOffset('2025-03-14T09:30')).toBe('2025-03-14T09:30:00+08:00');
    expect(toIsoWithOffset('')).toBeNull();
  });

  it('shows a timestamp in the viewer’s time zone, and round-trips', () => {
    expect(fromIsoToDatetimeLocal('2025-03-14T01:30:00Z')).toBe('2025-03-14T09:30');
    expect(fromIsoToDatetimeLocal(toIsoWithOffset('2025-12-31T23:45'))).toBe('2025-12-31T23:45');
    expect(fromIsoToDatetimeLocal(null)).toBe('');
  });
});

describe('dates and times as shown', () => {
  it('writes a date in Philippine English without shifting the day', () => {
    expect(formatDate('2025-03-14')).toBe('Mar 14, 2025');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('')).toBe('—');
  });

  it('writes AM/PM once when both ends of a period share it', () => {
    expect(plain(formatTimeRange('08:00', '08:50'))).toBe('8:00–8:50 AM');
    expect(plain(formatTimeRange('11:30', '12:20'))).toBe('11:30 AM–12:20 PM');
    expect(timeRangeParts('08:00', null).map(plain)).toEqual(['8:00 AM', '—']);
  });
});
