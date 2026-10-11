import './helpers/setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACADEMIC_YEAR_START_MONTH, FIRST_SEMESTER_MONTHS, SEMESTERS } from '../src/constants/shared.js';
import { academicYearOf, currentSemester, semesterOf, todayYmd } from '../src/utils/dates.js';

describe('semesterOf', () => {
  it('puts the first five months of the school year in the 1st Semester and the rest in the 2nd', () => {
    assert.equal(ACADEMIC_YEAR_START_MONTH, 8, 'the cases below are written for a school year from August');
    assert.equal(FIRST_SEMESTER_MONTHS, 5);
    const expected = {
      '2026-08-15': 'sem1',
      '2026-09-15': 'sem1',
      '2026-10-15': 'sem1',
      '2026-11-15': 'sem1',
      '2026-12-15': 'sem1',
      '2027-01-15': 'sem2',
      '2027-02-15': 'sem2',
      '2027-03-15': 'sem2',
      '2027-04-15': 'sem2',
      '2027-05-15': 'sem2',
      '2027-06-15': 'sem2',
      '2027-07-15': 'sem2',
    };
    for (const [date, semester] of Object.entries(expected)) {
      assert.equal(semesterOf(date), semester, date);
    }
  });

  it('changes on the first day of the month at both ends of the school year', () => {
    assert.equal(semesterOf('2026-07-31'), 'sem2', 'last day of the school year');
    assert.equal(semesterOf('2026-08-01'), 'sem1', 'first day of the school year');
    assert.equal(semesterOf('2026-12-31'), 'sem1', 'last day of the 1st Semester');
    assert.equal(semesterOf('2027-01-01'), 'sem2', 'first day of the 2nd Semester');
  });

  it('keeps both semesters in one academic year, the 2nd in the calendar year after the 1st', () => {
    assert.equal(academicYearOf('2026-10-03'), academicYearOf('2027-02-10'));
    assert.deepEqual(
      ['2026-10-03', '2027-02-10'].map((date) => semesterOf(date)),
      SEMESTERS,
    );
  });

  it('reads the school time zone for today, and today when no date is given', () => {
    // APP_TIMEZONE is UTC in the tests.
    assert.equal(currentSemester(new Date('2026-12-31T23:59:59Z')), 'sem1');
    assert.equal(currentSemester(new Date('2027-01-01T00:00:00Z')), 'sem2');
    assert.equal(semesterOf(), semesterOf(todayYmd()));
    assert.equal(currentSemester(), semesterOf(todayYmd()));
  });
});
