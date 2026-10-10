import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSchoolYear,
  schoolYearLabel,
  schoolYearsOf,
  yearChoices,
} from '../src/features/enrollments/schoolYears';

/** Sets the clock to a local date and time; months are 1-12 here. */
const today = (year, month, day, hour = 9) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, hour));
};

const enrollment = (enrolledOn, name, academicYear) => ({ enrolledOn, class: { name, academicYear } });

afterEach(() => {
  vi.useRealTimers();
});

describe('schoolYearsOf', () => {
  // A student in Grade 9 last year, who moved from 10-A to 10-B this year and already enrolled for Grade 11.
  const enrollments = [
    enrollment('2026-09-21', 'Grade 10 - B', '2026-2027'),
    enrollment('2026-10-05', 'Grade 11 - A', '2027-2028'),
    enrollment('2025-08-04', 'Grade 9 - A', '2025-2026'),
    enrollment('2026-08-03', 'Grade 10 - A', '2026-2027'),
  ];

  it('lists past and current years newest first, each with the class the student finished in', () => {
    today(2026, 10, 10);
    expect(schoolYearsOf(enrollments)).toEqual([
      { academicYear: '2026-2027', className: 'Grade 10 - B' },
      { academicYear: '2025-2026', className: 'Grade 9 - A' },
    ]);
  });

  it("leaves next year's class out until that school year starts on 1 August", () => {
    today(2027, 7, 31, 23);
    expect(schoolYearsOf(enrollments).map((year) => year.academicYear)).toEqual(['2026-2027', '2025-2026']);
    today(2027, 8, 1, 0);
    expect(schoolYearsOf(enrollments)[0]).toEqual({ academicYear: '2027-2028', className: 'Grade 11 - A' });
  });

  it('does not reorder the enrollments it is given, and has no years without enrollments', () => {
    today(2026, 10, 10);
    const copy = [...enrollments];
    schoolYearsOf(enrollments);
    expect(enrollments).toEqual(copy);
    expect(schoolYearsOf([])).toEqual([]);
  });
});

describe('yearChoices', () => {
  it('offers the current year first when the student has no class in it', () => {
    today(2026, 10, 10);
    const past = [{ academicYear: '2025-2026', className: 'Grade 9 - A' }];
    expect(yearChoices(past)).toEqual([{ academicYear: '2026-2027', className: null }, ...past]);
    expect(yearChoices([])).toEqual([{ academicYear: '2026-2027', className: null }]);
  });

  it("offers the student's own years when the current one is among them", () => {
    today(2026, 10, 10);
    const years = [
      { academicYear: '2026-2027', className: 'Grade 10 - B' },
      { academicYear: '2025-2026', className: 'Grade 9 - A' },
    ];
    expect(yearChoices(years)).toEqual(years);
  });
});

describe('defaultSchoolYear', () => {
  const years = [{ academicYear: '2025-2026' }, { academicYear: '2024-2025' }];

  it("opens on the year of the student's class", () => {
    today(2026, 10, 10);
    expect(defaultSchoolYear({ academicYear: '2026-2027' }, years)).toBe('2026-2027');
    expect(defaultSchoolYear({ academicYear: '2025-2026' }, years)).toBe('2025-2026');
  });

  it('opens on this year, where the results are, when the class starts next year', () => {
    today(2026, 10, 10);
    expect(defaultSchoolYear({ academicYear: '2027-2028' }, years)).toBe('2026-2027');
  });

  it('opens on the last year with a class, else on the current year', () => {
    today(2026, 10, 10);
    expect(defaultSchoolYear(null, years)).toBe('2025-2026');
    expect(defaultSchoolYear(null, [])).toBe('2026-2027');
  });

  it('follows the clock across the August turn of the year', () => {
    today(2026, 7, 31, 23);
    expect(defaultSchoolYear(null, [])).toBe('2025-2026');
    expect(defaultSchoolYear({ academicYear: '2026-2027' }, [])).toBe('2025-2026');
  });
});

it('labels a school year as AY', () => {
  expect(schoolYearLabel('2026-2027')).toBe('AY 2026-2027');
});
