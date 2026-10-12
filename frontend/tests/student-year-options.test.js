import { afterEach, describe, expect, it, vi } from 'vitest';
import { classYearOptions } from '../src/features/students/yearOptions';

/** Sets the clock to a local date; months are 1-12 here. */
const today = (year, month, day) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, 9));
};

const years = (options) => options.map((option) => option.value);

afterEach(() => {
  vi.useRealTimers();
});

describe('classYearOptions', () => {
  const classes = [
    { academicYear: '2026-2027' },
    { academicYear: '2025-2026' },
    { academicYear: '2027-2028' },
    { academicYear: '2026-2027' },
  ];

  it('offers each year that has classes once, newest first, labelled like the other year pickers', () => {
    today(2026, 10, 12);
    expect(classYearOptions(classes)).toEqual([
      { value: '2027-2028', label: 'AY 2027-2028' },
      { value: '2026-2027', label: 'AY 2026-2027' },
      { value: '2025-2026', label: 'AY 2025-2026' },
    ]);
  });

  it("always offers the current year, the one the dashboard's tile opens the list on", () => {
    today(2026, 10, 12);
    expect(years(classYearOptions([]))).toEqual(['2026-2027']);
    // Before 1 August the school year that started last August is still the current one.
    today(2027, 7, 31);
    expect(years(classYearOptions([{ academicYear: '2027-2028' }]))).toEqual(['2027-2028', '2026-2027']);
  });

  it('keeps the year of the URL, and only a real school year', () => {
    today(2026, 10, 12);
    expect(years(classYearOptions(classes, '2019-2020'))).toEqual([
      '2027-2028',
      '2026-2027',
      '2025-2026',
      '2019-2020',
    ]);
    expect(years(classYearOptions([], '2026-2028'))).toEqual(['2026-2027']);
    expect(years(classYearOptions([], ''))).toEqual(['2026-2027']);
  });
});
