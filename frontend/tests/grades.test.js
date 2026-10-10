import { describe, expect, it } from 'vitest';
import {
  averageOf,
  describeGrading,
  describeWeights,
  descriptorOf,
  formatResult,
  generalAverage,
  groupBy,
  isPassing,
  passMarkOf,
  percentageByType,
  resultWidth,
} from '../src/utils/grades';

/** A row of GET /grades as percentageByType reads it. Scores arrive as numbers or, from DECIMAL columns, strings. */
const grade = (type, score, maxScore) => ({ score, assessment: { type, maxScore } });

describe('groupBy', () => {
  it('keeps keys in the order they first appear, and rows in their order within a key', () => {
    const rows = [
      { id: 1, subject: 'math' },
      { id: 2, subject: 'english' },
      { id: 3, subject: 'math' },
    ];
    const groups = groupBy(rows, (row) => row.subject);
    expect([...groups.keys()]).toEqual(['math', 'english']);
    expect(groups.get('math').map((row) => row.id)).toEqual([1, 3]);
  });

  it('gives an empty map for no rows, and keeps the number 1 and the string "1" apart', () => {
    expect(groupBy([], (row) => row).size).toBe(0);
    const groups = groupBy([{ key: 1 }, { key: '1' }], (row) => row.key);
    expect(groups.size).toBe(2);
  });
});

describe('descriptorOf (DepEd descriptors)', () => {
  // Each band starts at its lower bound; one hundredth below it is the band underneath.
  const bands = [
    [100, 'Outstanding'],
    [90, 'Outstanding'],
    [89.99, 'Very Satisfactory'],
    [85, 'Very Satisfactory'],
    [84.99, 'Satisfactory'],
    [80, 'Satisfactory'],
    [79.99, 'Fairly Satisfactory'],
    [75, 'Fairly Satisfactory'],
    [74.99, 'Did Not Meet Expectations'],
    [60, 'Did Not Meet Expectations'],
    [0, 'Did Not Meet Expectations'],
  ];

  it.each(bands)('describes %s as %s', (result, label) => {
    expect(descriptorOf(result).label).toBe(label);
  });

  it('has no descriptor without a result', () => {
    expect(descriptorOf(null)).toBeNull();
    expect(descriptorOf(undefined)).toBeNull();
  });
});

describe('isPassing and passMarkOf', () => {
  it('passes from 75 up, and never without a result', () => {
    expect(isPassing(75)).toBe(true);
    expect(isPassing(100)).toBe(true);
    expect(isPassing(74.99)).toBe(false);
    expect(isPassing(0)).toBe(false);
    expect(isPassing(null)).toBe(false);
    expect(isPassing(undefined)).toBe(false);
  });

  it('marks a K-12 component at 60 (it transmutes to 75) and every other method at 75', () => {
    expect(passMarkOf('k12')).toBe(60);
    expect(passMarkOf('points')).toBe(75);
    expect(passMarkOf('weighted')).toBe(75);
  });
});

describe('averageOf', () => {
  it('ignores missing results and is null when nothing is left', () => {
    expect(averageOf([80, null, 90, undefined])).toBe(85);
    expect(averageOf([])).toBeNull();
    expect(averageOf([null, undefined])).toBeNull();
  });

  it('counts a result of 0 as a result, not as missing', () => {
    expect(averageOf([0, 90])).toBe(45);
  });

  it('rounds to 2 decimals, half up, despite floating-point dust', () => {
    expect(averageOf([1, 2, 2])).toBe(1.67);
    expect(averageOf([0.1, 0.2])).toBe(0.15);
    // 80.015 * 100 is 8001.499999999999 in floating point; a plain Math.round would give 80.01.
    expect(averageOf([80.01, 80.02])).toBe(80.02);
    expect(averageOf([1.005])).toBe(1.01);
  });
});

describe('generalAverage', () => {
  it('counts a subject taken in two classes of one year once', () => {
    // Moved from 10-A to 10-B mid-year: Math 60 then 90, English 80. (75 + 80) / 2, not (60 + 90 + 80) / 3.
    const subjects = [
      { subjectId: 1, academicYear: '2026-2027', percentage: 60 },
      { subjectId: 1, academicYear: '2026-2027', percentage: 90 },
      { subjectId: 2, academicYear: '2026-2027', percentage: 80 },
    ];
    expect(generalAverage(subjects)).toBe(77.5);
  });

  it('keeps one subject of two years apart and skips subjects without a result', () => {
    const subjects = [
      { subjectId: 1, academicYear: '2025-2026', percentage: 70 },
      { subjectId: 1, academicYear: '2026-2027', percentage: 90 },
      { subjectId: 2, academicYear: '2026-2027', percentage: null },
    ];
    expect(generalAverage(subjects)).toBe(80);
  });

  it('uses the graded class of a subject when its other class has no result yet', () => {
    const subjects = [
      { subjectId: 1, academicYear: '2026-2027', percentage: null },
      { subjectId: 1, academicYear: '2026-2027', percentage: 88 },
      { subjectId: 2, academicYear: '2026-2027', percentage: 92 },
    ];
    expect(generalAverage(subjects)).toBe(90);
  });

  it('is null with no subjects or none graded', () => {
    expect(generalAverage([])).toBeNull();
    expect(generalAverage([{ subjectId: 1, academicYear: '2026-2027', percentage: null }])).toBeNull();
  });
});

describe('percentageByType', () => {
  it('totals the points of each type before dividing, rather than averaging percentages', () => {
    // Quiz 1/2 (50%) and 19/20 (95%): 20/22 = 90.91%, not the 72.5% mean of the two.
    const grades = [grade('quiz', 1, 2), grade('quiz', 19, 20), grade('exam', 45, 50)];
    expect(percentageByType(grades)).toEqual({ quiz: 90.91, exam: 90 });
  });

  it('reads scores and max scores sent as decimal strings', () => {
    expect(percentageByType([grade('test', '8.5', '10.00'), grade('test', '7.25', '10')])).toEqual({
      test: 78.75,
    });
  });

  it('leaves out types without grades and gives an empty object for no grades', () => {
    expect(Object.keys(percentageByType([grade('project', 9, 10)]))).toEqual(['project']);
    expect(percentageByType([])).toEqual({});
  });

  it('rounds to 2 decimals without floating-point dust', () => {
    expect(percentageByType([grade('quiz', 2, 3)])).toEqual({ quiz: 66.67 });
    expect(percentageByType([grade('quiz', 0.1, 0.15), grade('quiz', 0.2, 0.15)])).toEqual({ quiz: 100 });
  });
});

describe('how a subject is graded, in words', () => {
  it('lists the weights in assessment-type order and leaves out types weighted 0', () => {
    expect(describeWeights({ exam: 80, test: 0, quiz: 20 })).toBe('Quiz 20% · Exam 80%');
    expect(describeWeights(null)).toBe('');
  });

  it('names the K-12 group and its weights, which win over per-type weights', () => {
    expect(describeGrading({ gradingGroup: 'math_science', gradeWeights: { quiz: 100 } })).toBe(
      'K-12 · Math and Science (40 · 40 · 20)',
    );
    expect(describeGrading({ gradingGroup: 'languages', gradeWeights: null })).toBe(
      'K-12 · Languages, AP, EsP (30 · 50 · 20)',
    );
  });

  it('falls back to the weights, then to points', () => {
    expect(describeGrading({ gradingGroup: null, gradeWeights: { quiz: 40, project: 60 } })).toBe(
      'Quiz 40% · Project 60%',
    );
    expect(describeGrading({ gradingGroup: null, gradeWeights: null })).toBe('On points');
  });
});

describe('result display helpers', () => {
  it('clamps a result bar to 0-100% and draws no bar without a result', () => {
    expect(resultWidth(87.5)).toBe('87.5%');
    expect(resultWidth(120)).toBe('100%');
    expect(resultWidth(-5)).toBe('0%');
    expect(resultWidth(null)).toBe('0%');
  });

  it('writes a result with at most 2 decimals, and an em dash without one', () => {
    expect(formatResult(90)).toBe('90');
    expect(formatResult(88.833)).toBe('88.83');
    expect(formatResult(null)).toBe('—');
  });
});
