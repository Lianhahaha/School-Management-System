import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assessmentDefaults,
  createAssessmentSchema,
  gradeSheetDefaults,
  gradeSheetSchema,
  toSaveGradesPayload,
} from '../src/features/grades/schemas';

/** A grade sheet row as the form holds it: every input is a string. */
const row = (studentId, score = '', remarks = '') => ({ studentId: String(studentId), score, remarks });

/** The issues of a failed parse as { 'rows.0.score': message }. */
function issuesOf(result) {
  expect(result.success).toBe(false);
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}

describe('gradeSheetSchema', () => {
  it('reads a blank score as "not graded yet" and trims and converts the rest', () => {
    const result = gradeSheetSchema(20).safeParse({
      rows: [row(1, ' 18.5 ', ' Good work '), row(2, '   '), row(3, '0')],
    });
    expect(result.success).toBe(true);
    expect(result.data.rows).toEqual([
      { studentId: 1, score: 18.5, remarks: 'Good work' },
      { studentId: 2, score: undefined, remarks: undefined },
      { studentId: 3, score: 0, remarks: undefined },
    ]);
  });

  it('accepts a score from 0 up to the assessment max score, inclusive', () => {
    expect(gradeSheetSchema(20).safeParse({ rows: [row(1, '20'), row(2, '0')] }).success).toBe(true);
    expect(gradeSheetSchema(12.5).safeParse({ rows: [row(1, '12.5')] }).success).toBe(true);
    expect(issuesOf(gradeSheetSchema(12.5).safeParse({ rows: [row(1, '12.51')] }))).toEqual({
      'rows.0.score': 'Score must be between 0 and 12.5',
    });
  });

  it('refuses negative scores, more than two decimals and text', () => {
    const result = gradeSheetSchema(20).safeParse({ rows: [row(1, '-1'), row(2, '10.555'), row(3, 'abc')] });
    expect(issuesOf(result)).toEqual({
      'rows.0.score': 'A score cannot be negative',
      'rows.1.score': 'Use at most two decimals',
      'rows.2.score': 'Enter a number',
    });
  });

  it('accepts two-decimal scores whose binary value is inexact', () => {
    const scores = ['0.07', '1.1', '4.35', '19.99', '99.99'];
    expect(
      gradeSheetSchema(100).safeParse({ rows: scores.map((score, i) => row(i + 1, score)) }).success,
    ).toBe(true);
  });

  it('refuses erasing a saved grade, which a save cannot unset', () => {
    const saved = [{ gradeId: 41 }, { gradeId: null }];
    const result = gradeSheetSchema(20, saved).safeParse({ rows: [row(1, ''), row(2, '')] });
    expect(issuesOf(result)).toEqual({ 'rows.0.score': 'To remove a saved grade, use Clear' });
  });

  it('refuses remarks typed for a student without a score', () => {
    const result = gradeSheetSchema(20).safeParse({
      rows: [row(1, '15', 'ok'), row(2, '', 'Absent, retake')],
    });
    expect(issuesOf(result)).toEqual({ 'rows.1.remarks': 'Add a score to save these remarks' });
  });

  it('matches saved grades to rows by position, as the roster is listed', () => {
    // Only the second row has a saved grade; the first was never graded, so leaving it blank is fine.
    const saved = [{ gradeId: null }, { gradeId: 7 }];
    const result = gradeSheetSchema(20, saved).safeParse({ rows: [row(1, ''), row(2, '')] });
    expect(issuesOf(result)).toEqual({ 'rows.1.score': 'To remove a saved grade, use Clear' });
  });

  it('limits remarks to 255 characters', () => {
    const ok = gradeSheetSchema(20).safeParse({ rows: [row(1, '10', 'x'.repeat(255))] });
    expect(ok.success).toBe(true);
    const tooLong = gradeSheetSchema(20).safeParse({ rows: [row(1, '10', 'x'.repeat(256))] });
    expect(issuesOf(tooLong)).toEqual({ 'rows.0.remarks': 'Use 255 characters or fewer' });
  });
});

describe('gradeSheetDefaults', () => {
  it('turns the saved roster into form strings, blank where nothing is recorded', () => {
    const records = [
      { studentId: 1, score: 18.5, remarks: 'Good' },
      { studentId: 2, score: 0, remarks: null },
      { studentId: 3, score: null, remarks: null },
    ];
    expect(gradeSheetDefaults(records).rows).toEqual([
      { studentId: 1, score: '18.5', remarks: 'Good' },
      { studentId: 2, score: '0', remarks: '' },
      { studentId: 3, score: '', remarks: '' },
    ]);
  });
});

describe('toSaveGradesPayload', () => {
  const saved = [
    { studentId: 1, score: 15, remarks: 'Late' },
    { studentId: 2, score: null, remarks: null },
    { studentId: 3, score: 9, remarks: null },
  ];

  it('sends only scored rows, each with the grade the sheet was opened with', () => {
    const values = {
      rows: [
        { studentId: 1, score: 16, remarks: undefined },
        { studentId: 2, score: 12.5, remarks: 'Make-up' },
        { studentId: 4, score: undefined, remarks: undefined },
      ],
    };
    expect(toSaveGradesPayload(values, saved)).toEqual([
      { studentId: 1, score: 16, remarks: undefined, previous: { score: 15, remarks: 'Late' } },
      { studentId: 2, score: 12.5, remarks: 'Make-up', previous: { score: null, remarks: null } },
    ]);
  });

  it('keeps a score of 0 and matches the saved grade by student, not by position', () => {
    const values = { rows: [{ studentId: 3, score: 0, remarks: undefined }] };
    expect(toSaveGradesPayload(values, saved)).toEqual([
      { studentId: 3, score: 0, remarks: undefined, previous: { score: 9, remarks: null } },
    ]);
  });

  it('treats a student missing from the saved roster as ungraded, and sends nothing for an empty sheet', () => {
    const values = { rows: [{ studentId: 99, score: 10, remarks: undefined }] };
    expect(toSaveGradesPayload(values, saved)[0].previous).toEqual({ score: null, remarks: null });
    expect(toSaveGradesPayload({ rows: [] }, saved)).toEqual([]);
  });
});

describe('assessment form', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const valid = {
    classSubjectId: '12',
    title: '  Quiz 1 ',
    type: 'quiz',
    term: 'term1',
    maxScore: '50',
    assessedOn: '2026-10-09',
  };

  it('converts ids and numbers and trims the title', () => {
    const result = createAssessmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ classSubjectId: 12, title: 'Quiz 1', maxScore: 50 });
  });

  it('keeps the max score above 0, at most 1000 and to two decimals', () => {
    const maxScoreIssue = (maxScore) =>
      issuesOf(createAssessmentSchema.safeParse({ ...valid, maxScore })).maxScore;
    expect(maxScoreIssue('0')).toBe('Max score must be greater than 0');
    expect(maxScoreIssue('1000.01')).toBe('Max score cannot be more than 1000');
    expect(maxScoreIssue('12.345')).toBe('Use at most two decimals');
    expect(createAssessmentSchema.safeParse({ ...valid, maxScore: '1000' }).success).toBe(true);
  });

  it('refuses a missing class, a blank title and a date that is not on the calendar', () => {
    const result = createAssessmentSchema.safeParse({
      ...valid,
      classSubjectId: '',
      title: '   ',
      assessedOn: '2026-02-30',
    });
    expect(issuesOf(result)).toEqual({
      classSubjectId: 'Choose a class and subject',
      title: 'This field is required',
      assessedOn: 'Enter a valid date',
    });
  });

  it('opens a new assessment on today with a max score of 100, and an edit on its saved values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 23, 30));
    expect(assessmentDefaults(null, 12)).toEqual({
      classSubjectId: '12',
      title: '',
      type: '',
      term: '',
      maxScore: 100,
      assessedOn: '2026-10-09',
    });
    const saved = { title: 'Exam', type: 'exam', term: 'term2', maxScore: 80, assessedOn: '2026-03-02' };
    expect(assessmentDefaults(saved, 12)).toEqual(saved);
  });
});
