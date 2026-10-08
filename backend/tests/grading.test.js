import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { averageOf, generalAverageOf, subjectResult, transmute } from '../src/utils/grading.js';

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
    assert.deepEqual(subjectResult(graded, weights), {
      percentage: 76,
      initialGrade: 76,
      method: 'weighted',
      components: null,
    });
    assert.deepEqual(subjectResult([], weights), {
      percentage: null,
      initialGrade: null,
      method: 'weighted',
      components: null,
    });
    assert.equal(averageOf([null, undefined]), null);
  });

  it('transmutes an initial grade exactly as the DepEd table does', () => {
    const table = [
      [100, 100],
      [99.99, 99],
      [98.4, 99],
      [98.39, 98],
      [84, 90],
      [83.99, 89],
      [76, 85],
      [75.99, 84],
      [60, 75],
      [59.99, 74],
      [56, 74],
      [55.99, 73],
      [4, 61],
      [3.99, 60],
      [0, 60],
    ];
    for (const [initial, grade] of table) assert.equal(transmute(initial), grade, String(initial));
    assert.equal(transmute(null), null);
  });

  it('grades a K-12 subject by its weighted components, transmuted', () => {
    // Math and Science: written 40, performance 40, quarterly 20.
    const typeTotals = [
      { type: 'quiz', totalScore: 35, totalMaxScore: 40, assessmentsGraded: 2 },
      { type: 'assignment', totalScore: 9, totalMaxScore: 10, assessmentsGraded: 1 },
      { type: 'project', totalScore: 42, totalMaxScore: 50, assessmentsGraded: 1 },
      { type: 'exam', totalScore: 39, totalMaxScore: 50, assessmentsGraded: 1 },
    ];
    const result = subjectResult(typeTotals, null, 'math_science');
    // written 44/50 = 88, performance 84, quarterly 78: 88*.4 + 84*.4 + 78*.2 = 84.4, transmuted 90.
    assert.equal(result.method, 'k12');
    assert.equal(result.initialGrade, 84.4);
    assert.equal(result.percentage, 90);
    assert.deepEqual(
      result.components.map((part) => [part.component, part.weight, part.percentage, part.assessmentsGraded]),
      [
        ['written', 40, 88, 3],
        ['performance', 40, 84, 1],
        ['quarterly', 20, 78, 1],
      ],
    );
  });

  it('leaves out a K-12 component with nothing graded yet', () => {
    const result = subjectResult([{ type: 'quiz', totalScore: 18, totalMaxScore: 20 }], null, 'languages');
    assert.equal(result.initialGrade, 90); // only written work so far
    assert.equal(result.percentage, 93);
    assert.equal(subjectResult([], null, 'mapeh').percentage, null);
  });

  it('rounds half up even where floating point lands just below the half', () => {
    // (1 + 1.01) / 2 is 1.005, stored as 1.00499999...; plain Math.round(x * 100) / 100 gives 1.
    assert.equal(averageOf([1, 1.01]), 1.01);
    assert.equal(averageOf([2 / 3]), 0.67);
  });
});
