import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PERIODS,
  WHOLE_YEAR_PARAM,
  defaultSemester,
  gradeColumnsOf,
  periodTitle,
  semesterFromParam,
  semesterToParam,
} from '../src/features/grades/periods';
import { defaultAssessmentSemester } from '../src/features/grades/schemas';

/** Sets the local date and time the app sees as today. */
function today(year, month, day) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the periods a school year offers', () => {
  it('are the whole year, then the 1st and 2nd Semester, with no quarter and no summer', () => {
    expect(PERIODS).toEqual([
      { semester: '', label: 'Whole year' },
      { semester: 'sem1', label: '1st Semester' },
      { semester: 'sem2', label: '2nd Semester' },
    ]);
  });

  it('are written with the school year, as the picker shows them', () => {
    expect(periodTitle('2026-2027', 'sem1')).toBe('AY 2026-2027 · 1st Semester');
    expect(periodTitle('2026-2027', 'sem2')).toBe('AY 2026-2027 · 2nd Semester');
    expect(periodTitle('2025-2026', '')).toBe('AY 2025-2026 · Whole year');
  });
});

describe('the period a school year opens on', () => {
  it('is the current semester in the school year we are in', () => {
    today(2026, 10, 11);
    expect(defaultSemester('2026-2027')).toBe('sem1');
    today(2026, 12, 31);
    expect(defaultSemester('2026-2027')).toBe('sem1');
    today(2027, 1, 1);
    expect(defaultSemester('2026-2027')).toBe('sem2');
    today(2027, 7, 31);
    expect(defaultSemester('2026-2027')).toBe('sem2');
  });

  it('is the whole year for any other school year', () => {
    today(2026, 10, 11);
    expect(defaultSemester('2025-2026')).toBe('');
    expect(defaultSemester('2027-2028')).toBe('');
    today(2027, 2, 15);
    expect(defaultSemester('2025-2026')).toBe('');
  });

  it('turns over with the school year on 1 August', () => {
    today(2027, 7, 31);
    expect(defaultSemester('2026-2027')).toBe('sem2');
    expect(defaultSemester('2027-2028')).toBe('');
    today(2027, 8, 1);
    expect(defaultSemester('2026-2027')).toBe('');
    expect(defaultSemester('2027-2028')).toBe('sem1');
  });
});

describe('the semester in the URL', () => {
  it("is the one named, 'all' for the whole year, and the year's default when missing or unknown", () => {
    today(2027, 3, 1);
    expect(semesterFromParam('sem1', '2026-2027')).toBe('sem1');
    expect(semesterFromParam('sem2', '2025-2026')).toBe('sem2');
    expect(semesterFromParam(WHOLE_YEAR_PARAM, '2026-2027')).toBe('');
    expect(semesterFromParam('', '2026-2027')).toBe('sem2');
    expect(semesterFromParam(null, '2025-2026')).toBe('');
    expect(semesterFromParam('term1', '2026-2027')).toBe('sem2');
    expect(semesterFromParam('summer', '2025-2026')).toBe('');
  });

  it('writes the whole year out, so choosing it in the current year is not undone by the default', () => {
    today(2026, 10, 11);
    expect(semesterToParam('')).toBe('all');
    expect(semesterToParam('sem2')).toBe('sem2');
    expect(semesterFromParam(semesterToParam(''), '2026-2027')).toBe('');
    expect(semesterFromParam(semesterToParam('sem2'), '2026-2027')).toBe('sem2');
  });
});

describe('the grade columns of a period', () => {
  const quarterRow = { quarters: { term1: 88, term2: null, term3: 90, term4: null } };
  const yearRow = { semesters: { sem1: 89, sem2: null } };

  it('are the four quarters of a semester', () => {
    const columns = gradeColumnsOf('sem1');
    expect(columns.map((column) => column.header)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(columns.map((column) => column.gradeOf(quarterRow))).toEqual([88, null, 90, null]);
  });

  it('are the two semesters of the whole year', () => {
    const columns = gradeColumnsOf('');
    expect(columns.map((column) => column.header)).toEqual(['1st Semester', '2nd Semester']);
    expect(columns.map((column) => column.gradeOf(yearRow))).toEqual([89, null]);
  });

  it('read a row without that period as no grade, so a table or card never throws', () => {
    expect(gradeColumnsOf('sem2').map((column) => column.gradeOf({}))).toEqual([null, null, null, null]);
    expect(gradeColumnsOf('').map((column) => column.gradeOf({}))).toEqual([null, null]);
    expect(gradeColumnsOf('').map((column) => column.gradeOf(quarterRow))).toEqual([null, null]);
  });
});

describe("a new assessment's semester", () => {
  it('is the semester of its date', () => {
    expect(defaultAssessmentSemester('2026-08-01')).toBe('sem1');
    expect(defaultAssessmentSemester('2026-12-31')).toBe('sem1');
    expect(defaultAssessmentSemester('2027-01-01')).toBe('sem2');
    expect(defaultAssessmentSemester('2027-07-31')).toBe('sem2');
  });

  it('is the current semester while the date is blank or incomplete', () => {
    today(2026, 10, 11);
    expect(defaultAssessmentSemester('')).toBe('sem1');
    expect(defaultAssessmentSemester('2027-01')).toBe('sem1');
    today(2027, 3, 1);
    expect(defaultAssessmentSemester('')).toBe('sem2');
    expect(defaultAssessmentSemester('not a date')).toBe('sem2');
  });
});
