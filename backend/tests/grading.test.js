import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { averageOf, generalAverageOf, subjectResult } from '../src/utils/grading.js';

describe('grading arithmetic', () => {
  it('counts a subject taken in two classes of one year once in the general average', () => {
    // Moved from 10-A to 10-B in January: Math 60 in 10-A, Math 90 in 10-B, English 80 in 10-B.
    const results = [
      { subjectId: 1, academicYear: '2026-2027', percentage: 60 },
      { subjectId: 1, academicYear: '2026-2027', percentage: 90 },
      { subjectId: 2, academicYear: '2026-2027', percentage: 80 },
    ];
    assert.equal(generalAverageOf(results), 77.5); // (75 + 80) / 2, not (60 + 90 + 80) / 3
  });

  it('keeps the same subject of different years apart, and skips subjects without a result', () => {
    const results = [
      { subjectId: 1, academicYear: '2025-2026', percentage: 70 },
      { subjectId: 1, academicYear: '2026-2027', percentage: 90 },
      { subjectId: 2, academicYear: '2026-2027', percentage: null },
    ];
    assert.equal(generalAverageOf(results), 80);
    assert.equal(generalAverageOf([]), null);
  });

  it('weights a subject per assessment type over the types that have grades', () => {
    const weights = { quiz: 20, exam: 80 };
    const graded = [
      { type: 'quiz', totalScore: 10, totalMaxScore: 10 },
      { type: 'exam', totalScore: 56, totalMaxScore: 80 },
    ];
    assert.deepEqual(subjectResult(graded, weights), { percentage: 76, method: 'weighted' });
    assert.deepEqual(subjectResult([], weights), { percentage: null, method: 'weighted' });
    assert.equal(averageOf([null, undefined]), null);
  });

  it('rounds half up even where floating point lands just below the half', () => {
    // (1 + 1.01) / 2 is 1.005, stored as 1.00499999...; plain Math.round(x * 100) / 100 gives 1.
    assert.equal(averageOf([1, 1.01]), 1.01);
    assert.equal(averageOf([2 / 3]), 0.67);
  });
});
