import { describe, expect, it } from 'vitest';
import {
  averageOf,
  describeGrading,
  describeQuarters,
  describeWeights,
  descriptorOf,
  finalGradeOf,
  formatResult,
  generalAverage,
  gradedQuarters,
  groupBy,
  isPassing,
  passMarkOf,
  remarksOf,
  resultWidth,
  subjectFinalGrade,
  subjectQuarters,
} from '../src/utils/grades';

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

  it('remarks Passed from 75 up, Failed below, and nothing without a grade', () => {
    expect(remarksOf(75)).toBe('Passed');
    expect(remarksOf(100)).toBe('Passed');
    expect(remarksOf(74.99)).toBe('Failed');
    expect(remarksOf(60)).toBe('Failed');
    expect(remarksOf(null)).toBe('');
    expect(remarksOf(undefined)).toBe('');
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

/** Quarterly grades of a summary row, Q1 to Q4; null = nothing graded in that quarter. */
const quarters = (term1 = null, term2 = null, term3 = null, term4 = null) => ({ term1, term2, term3, term4 });

/** A row of GET /grades/summary?groupBy=classSubject as the averages read it. */
const subjectRow = (subjectId, academicYear, quarterGrades, method = 'points') => ({
  subjectId,
  academicYear,
  method,
  quarters: quarterGrades,
});

describe('finalGradeOf', () => {
  it('averages the quarters graded so far, a whole number (half up) for K-12', () => {
    expect(finalGradeOf([88, 89, null, null], 'k12')).toBe(89); // 88.5
    expect(finalGradeOf([88, 89, 89], 'k12')).toBe(89); // 88.67
    expect(finalGradeOf([74, 74, 74, 75], 'k12')).toBe(74); // 74.25
    expect(finalGradeOf([74, 74, 75, 75], 'k12')).toBe(75); // 74.5
    expect(finalGradeOf([null, undefined], 'k12')).toBeNull();
  });

  it('keeps 2 decimals on points and weighted, half up despite floating-point dust', () => {
    expect(finalGradeOf([95, 20], 'points')).toBe(57.5);
    expect(finalGradeOf([80.01, 80.02], 'weighted')).toBe(80.02);
    expect(finalGradeOf([], 'points')).toBeNull();
  });
});

describe('subjectQuarters and subjectFinalGrade', () => {
  it("is a single class's own final grade", () => {
    const row = subjectRow(1, '2026-2027', quarters(91, 73, null, 96), 'k12');
    expect(subjectQuarters([row])).toEqual(row.quarters);
    expect(subjectFinalGrade([row])).toBe(87); // 86.67
  });

  it('puts the quarters of two classes together instead of averaging the class results', () => {
    // Q1 in 10-A, Q2 to Q4 in 10-B: (70 + 80 + 84 + 86) / 4 = 80, not (70 + 83) / 2 = 76.5.
    const rows = [
      subjectRow(1, '2026-2027', quarters(70), 'k12'),
      subjectRow(1, '2026-2027', quarters(null, 80, 84, 86), 'k12'),
    ];
    expect(subjectQuarters(rows)).toEqual(quarters(70, 80, 84, 86));
    expect(subjectFinalGrade(rows)).toBe(80);
  });

  it('averages a quarter graded in both classes the same way', () => {
    const rows = [
      subjectRow(1, '2026-2027', quarters(88, 80), 'k12'),
      subjectRow(1, '2026-2027', quarters(null, 85), 'k12'),
    ];
    expect(subjectQuarters(rows)).toEqual(quarters(88, 83)); // 82.5, half up
    expect(subjectFinalGrade(rows)).toBe(86); // 85.5
  });
});

describe('gradedQuarters and describeQuarters', () => {
  it('lists the quarters with a grade, in order', () => {
    const row = { quarters: quarters(88, null, 90.5) };
    expect(gradedQuarters(row)).toEqual(['term1', 'term3']);
    expect(describeQuarters(row)).toBe('Q1 88, Q3 90.5');
    expect(gradedQuarters({ quarters: quarters() })).toEqual([]);
    expect(gradedQuarters({})).toEqual([]);
  });
});

describe('generalAverage', () => {
  it('counts a subject taken in two classes of one year once', () => {
    // Moved from 10-A to 10-B at the half year: Math 60 in Q1 and Q2, then 90 in Q3 and Q4; English 80.
    // (75 + 80) / 2, not (60 + 90 + 80) / 3.
    const subjects = [
      subjectRow(1, '2026-2027', quarters(60, 60)),
      subjectRow(1, '2026-2027', quarters(null, null, 90, 90)),
      subjectRow(2, '2026-2027', quarters(80, 80, 80, 80)),
    ];
    expect(generalAverage(subjects)).toBe(77.5);
  });

  it('keeps one subject of two years apart and skips subjects without a result', () => {
    const subjects = [
      subjectRow(1, '2025-2026', quarters(70)),
      subjectRow(1, '2026-2027', quarters(90)),
      subjectRow(2, '2026-2027', quarters()),
    ];
    expect(generalAverage(subjects)).toBe(80);
  });

  it('uses the graded class of a subject when its other class has no result yet', () => {
    const subjects = [
      subjectRow(1, '2026-2027', quarters()),
      subjectRow(1, '2026-2027', quarters(88)),
      subjectRow(2, '2026-2027', quarters(92)),
    ];
    expect(generalAverage(subjects)).toBe(90);
  });

  it('is null with no subjects or none graded', () => {
    expect(generalAverage([])).toBeNull();
    expect(generalAverage([subjectRow(1, '2026-2027', quarters())])).toBeNull();
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
