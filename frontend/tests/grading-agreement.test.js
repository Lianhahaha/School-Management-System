/**
 * The API and the frontend both do grade arithmetic: the API computes every quarterly grade and each
 * class-subject's final grade (backend/src/utils/grading.js), the frontend what spans several summary rows (a
 * subject's final grade over two classes of a year, the general average), the per-type bars of a subject and
 * the pass/fail line (src/utils/grades.js). This test runs one fixed table through both sides and expects the
 * same numbers, so a change to the rounding, the quarter or averaging rule or the passing grade on one side
 * fails here until the other side follows.
 *
 * The backend module is imported by relative path. It imports nothing but constants/shared.js, which is the
 * same file byte for byte on both sides (backend `npm run check:constants`), so this needs neither the
 * database nor the backend's packages, and runs in the frontend suite and its CI job.
 */
import { describe, expect, it } from 'vitest';
import * as api from '../../backend/src/utils/grading.js';
import { COMPONENT_OF_TYPE, GRADING_GROUPS, TERMS } from '../src/constants/shared';
import {
  averageOf,
  descriptorOf,
  finalGradeOf,
  generalAverage,
  groupBy,
  isPassing,
  passMarkOf,
  percentageByType,
  subjectFinalGrade,
  subjectQuarters,
} from '../src/utils/grades';

/** A grade as GET /grades returns it, the shape the frontend reads, in a quarter (term1 to term4). */
const grade = (type, score, maxScore, term = 'term1') => ({ score, assessment: { type, maxScore, term } });

/**
 * The totals the API's summary query hands to finalResult: per quarter and assessment type, or with
 * `perQuarter: false` per type over every quarter (what a bar of the subject page shows). MySQL sums DECIMAL
 * scores exactly; sumPoints is the API's own exact sum of 2-decimal points, so it stands in for the query here.
 */
function typeTotalsOf(grades, { perQuarter = true } = {}) {
  const groups = new Map();
  for (const { score, assessment } of grades) {
    const key = perQuarter ? `${assessment.term}|${assessment.type}` : assessment.type;
    const total = groups.get(key) ?? { term: assessment.term, type: assessment.type, scores: [], maxes: [] };
    total.scores.push(Number(score));
    total.maxes.push(Number(assessment.maxScore));
    groups.set(key, total);
  }
  return [...groups.values()].map(({ term, type, scores, maxes }) => ({
    ...(perQuarter && { term }),
    type,
    totalScore: api.sumPoints(scores),
    totalMaxScore: api.sumPoints(maxes),
    assessmentsGraded: scores.length,
  }));
}

/**
 * One student's class-subjects over two school years, covering every grading method: K-12 in each grading
 * group (one with a component not graded yet), weighted (one with a weighted type not graded yet, and a
 * quarter graded only in a type weighted 0), on points, a subject with nothing graded, and Math taken in two
 * classes of one year (the student changed class in the 2nd Quarter, so that quarter has grades in both).
 * The grades are spread over the quarters, with gaps, so the quarter rule differs from grading the year at once.
 */
const CLASS_SUBJECTS = [
  {
    name: 'Math, 10-A',
    subjectId: 1,
    academicYear: '2026-2027',
    group: 'math_science',
    weights: null,
    grades: [
      grade('quiz', 18, 20, 'term1'),
      grade('assignment', 9, 10, 'term1'),
      grade('quiz', 17, 20, 'term2'),
      grade('project', 42, 50, 'term2'),
      grade('exam', 39, 50, 'term2'),
    ],
  },
  {
    name: 'Math, 10-B after the class change',
    subjectId: 1,
    academicYear: '2026-2027',
    group: 'math_science',
    weights: null,
    grades: [
      grade('quiz', 12, 20, 'term2'),
      grade('project', 30, 50, 'term3'),
      grade('exam', 31, 50, 'term4'),
    ],
  },
  {
    name: 'English, no quarterly assessment yet',
    subjectId: 2,
    academicYear: '2026-2027',
    group: 'languages',
    weights: null,
    grades: [
      grade('quiz', 7.5, 10, 'term1'),
      grade('test', 41, 50, 'term1'),
      grade('project', 88, 100, 'term2'),
    ],
  },
  {
    name: 'MAPEH, nothing in the 2nd Quarter',
    subjectId: 3,
    academicYear: '2026-2027',
    group: 'mapeh',
    weights: null,
    grades: [
      grade('test', 33.5, 40, 'term1'),
      grade('other', 19, 20, 'term1'),
      grade('project', 45.25, 50, 'term3'),
      grade('exam', 70, 100, 'term4'),
    ],
  },
  {
    name: 'Computer, weighted quiz 20 exam 80',
    subjectId: 4,
    academicYear: '2026-2027',
    group: null,
    weights: { quiz: 20, test: 0, exam: 80, assignment: 0, project: 0, other: 0 },
    grades: [grade('quiz', 9, 10, 'term1'), grade('quiz', 8.25, 10, 'term2'), grade('exam', 56, 80, 'term2')],
  },
  {
    name: 'Research, weighted, the test not graded yet, the 2nd Quarter only in a quiz weighted 0',
    subjectId: 5,
    academicYear: '2026-2027',
    group: null,
    weights: { quiz: 0, test: 40, exam: 0, assignment: 0, project: 60, other: 0 },
    grades: [grade('project', 37, 50, 'term1'), grade('quiz', 10, 10, 'term2')],
  },
  {
    name: 'Homeroom, on points',
    subjectId: 6,
    academicYear: '2026-2027',
    group: null,
    weights: null,
    grades: [
      grade('assignment', 10, 10, 'term1'),
      grade('other', '4.50', '6.00', 'term2'),
      grade('quiz', 2, 3, 'term4'),
    ],
  },
  {
    name: 'Filipino, nothing graded yet',
    subjectId: 7,
    academicYear: '2026-2027',
    group: null,
    weights: null,
    grades: [],
  },
  {
    name: 'Math, the year before, on points',
    subjectId: 1,
    academicYear: '2025-2026',
    group: null,
    weights: null,
    grades: [grade('quiz', 70, 100, 'term1'), grade('exam', 61.5, 80, 'term3')],
  },
];

/** The API's result of a class-subject: its quarterly grades and final grade. */
const apiResult = (classSubject) =>
  api.finalResult(typeTotalsOf(classSubject.grades), classSubject.weights, classSubject.group);

/** The API's result under the old rule, every assessment of the year graded together. */
const wholeYearResult = (classSubject) =>
  api.subjectResult(
    typeTotalsOf(classSubject.grades, { perQuarter: false }),
    classSubject.weights,
    classSubject.group,
  );

/** The rows of GET /grades/summary?groupBy=classSubject that the frontend averages. */
const summaryRows = CLASS_SUBJECTS.map((classSubject) => {
  const { percentage, method, quarters } = apiResult(classSubject);
  return {
    subjectId: classSubject.subjectId,
    academicYear: classSubject.academicYear,
    percentage,
    method,
    quarters,
  };
});

/** Quarterly grades in TERMS order: [88, null, 90, null] -> { term1: 88, term2: null, ... }. */
const quartersOf = (values) => Object.fromEntries(TERMS.map((term, index) => [term, values[index] ?? null]));

describe('frontend and API agree on grades', () => {
  it('covers every grading method in the table', () => {
    const methods = new Set(CLASS_SUBJECTS.map((classSubject) => apiResult(classSubject).method));
    expect([...methods].sort()).toEqual(['k12', 'points', 'weighted']);
    const groups = new Set(CLASS_SUBJECTS.map((classSubject) => classSubject.group).filter(Boolean));
    expect([...groups].sort()).toEqual([...GRADING_GROUPS].sort());
  });

  it('covers the quarter cases: the old rule disagreeing, a gap quarter and a quarter without a grade', () => {
    const results = CLASS_SUBJECTS.map((classSubject) => [classSubject, apiResult(classSubject)]);
    // In every method some subject's final grade differs from grading its whole year at once.
    for (const method of ['k12', 'points', 'weighted']) {
      expect(
        results.some(
          ([classSubject, result]) =>
            result.method === method && result.percentage !== wholeYearResult(classSubject).percentage,
        ),
        method,
      ).toBe(true);
    }
    // A quarter with nothing graded between graded ones (MAPEH's 2nd), and one graded only in a type
    // weighted 0 (Research's 2nd), which has no grade either.
    const quarterGrades = (name) => results.find(([classSubject]) => classSubject.name.startsWith(name))[1];
    expect(quarterGrades('MAPEH').quarters.term2).toBeNull();
    expect(quarterGrades('MAPEH').quarters.term3).not.toBeNull();
    expect(quarterGrades('Research').quarters).toEqual(quartersOf([74]));
  });

  it("gives each subject the same quarterly and final grades over its classes of a year, a single class's own", () => {
    const bySubject = groupBy(summaryRows, (row) => `${row.subjectId}:${row.academicYear}`);
    expect([...bySubject.values()].some((rows) => rows.length > 1)).toBe(true);
    for (const [key, rows] of bySubject) {
      expect(subjectQuarters(rows), key).toEqual(api.subjectQuarters(rows));
      expect(subjectFinalGrade(rows), key).toBe(api.subjectFinalGrade(rows));
      if (rows.length === 1) expect(subjectFinalGrade(rows), key).toBe(rows[0].percentage);
    }
    // Math of 2026-2027: Q1 from 10-A, Q2 graded in both classes, Q3 and Q4 from 10-B.
    const math = bySubject.get('1:2026-2027');
    expect(Object.values(subjectQuarters(math)).every((value) => value !== null)).toBe(true);
  });

  it('computes the same general average over every method, per year and overall', () => {
    for (const year of ['2025-2026', '2026-2027']) {
      const rows = summaryRows.filter((row) => row.academicYear === year);
      expect(generalAverage(rows), year).toBe(api.generalAverageOf(rows));
    }
    expect(generalAverage(summaryRows)).toBe(api.generalAverageOf(summaryRows));
    expect(generalAverage(summaryRows)).not.toBeNull();
  });

  it.each([
    ['K-12, two quarters ending in .5', [88, 89, null, null], 'k12'],
    ['K-12, a third', [88, 89, 89, null], 'k12'],
    ['K-12, just under the passing grade', [74, 74, 74, 75], 'k12'],
    ['K-12, half up to the passing grade', [74, 74, 75, 75], 'k12'],
    ['K-12, a gap quarter', [90, null, 85, 80], 'k12'],
    ['points, a mean ending in 5 under floating-point dust', [80.01, 80.02, null, null], 'points'],
    ['weighted, a repeating decimal', [90, 85, 70, null], 'weighted'],
    ['no quarter graded', [null, null, null, null], 'k12'],
  ])('averages the quarterly grades of %s the same way', (_label, values, method) => {
    expect(finalGradeOf(values, method)).toBe(api.finalGradeOf(values, method));
    const row = { subjectId: 1, academicYear: '2026-2027', method, quarters: quartersOf(values) };
    expect(subjectFinalGrade([row])).toBe(api.subjectFinalGrade([row]));
    expect(generalAverage([row])).toBe(api.generalAverageOf([row]));
  });

  it.each([
    ['no results', []],
    ['only subjects without a result', [null, null]],
    ['a mean ending in 5 under floating-point dust', [80.01, 80.02]],
    ['a repeating decimal', [1, 2, 2]],
    ['sums with binary dust', [0.1, 0.2]],
    ['a result of 0', [0, 100]],
    ['K-12 grades with points results', [75, 74.99, 88.83, 60, 100]],
  ])('averages %s the same way', (_label, percentages) => {
    expect(averageOf(percentages)).toBe(api.averageOf(percentages));
    // The same results as separate subjects graded in the 1st Quarter, then as one subject taken in several
    // classes of a year (their 1st Quarters averaged).
    const separate = percentages.map((percentage, index) => ({
      subjectId: index + 1,
      academicYear: '2026-2027',
      method: 'points',
      quarters: quartersOf([percentage]),
    }));
    const oneSubject = separate.map((row) => ({ ...row, subjectId: 1 }));
    expect(generalAverage(separate)).toBe(api.generalAverageOf(separate));
    expect(generalAverage(oneSubject)).toBe(api.generalAverageOf(oneSubject));
  });

  it("draws each assessment type's bar at the figure the API computes for that type", () => {
    for (const classSubject of CLASS_SUBJECTS) {
      const bars = percentageByType(classSubject.grades);
      for (const totals of typeTotalsOf(classSubject.grades, { perQuarter: false })) {
        const label = `${classSubject.name}: ${totals.type}`;
        // On points, one type alone; weighted, one type weighted 100: both are that type's points percentage.
        expect(bars[totals.type], label).toBe(api.subjectResult([totals], null).percentage);
        expect(bars[totals.type], label).toBe(api.subjectResult([totals], { [totals.type]: 100 }).percentage);
      }
    }
  });

  it("lists a K-12 component's grades at the percentage the API gives that component", () => {
    for (const classSubject of CLASS_SUBJECTS.filter((row) => row.group)) {
      // The subject page groups the grades by component (COMPONENT_OF_TYPE) under the API's component figures,
      // which cover every quarter of the period shown.
      const byComponent = percentageByType(
        classSubject.grades.map(({ score, assessment }) => ({
          score,
          assessment: { ...assessment, type: COMPONENT_OF_TYPE[assessment.type] },
        })),
      );
      for (const part of apiResult(classSubject).components) {
        expect(byComponent[part.component] ?? null, `${classSubject.name}: ${part.component}`).toBe(
          part.percentage,
        );
      }
    }
  });

  // A subject scored exactly at the frontend's pass mark for its method, in every part of every quarter, and
  // one hundredth below it. The API's final grade of the first must pass on the frontend and the second must
  // not.
  it.each([
    ['points', null, null],
    ['weighted', { quiz: 30, exam: 70 }, null],
    ...GRADING_GROUPS.map((group) => ['k12', null, group]),
  ])(
    'puts the pass mark of a subject graded %s where the API passes it (%o, %s)',
    (method, weights, group) => {
      const scoredAt = (percent) =>
        api.finalResult(
          typeTotalsOf(
            TERMS.flatMap((term) => [
              grade('quiz', percent, 100, term),
              grade('project', percent, 100, term),
              grade('exam', percent, 100, term),
            ]),
          ),
          weights,
          group,
        );
      const mark = passMarkOf(method);
      const atMark = scoredAt(mark);
      const below = scoredAt(api.sumPoints([mark, -0.01]));

      expect(atMark.method).toBe(method);
      expect(isPassing(atMark.percentage)).toBe(true);
      expect(descriptorOf(atMark.percentage).label).toBe('Fairly Satisfactory');
      expect(isPassing(below.percentage)).toBe(false);
      expect(descriptorOf(below.percentage).label).toBe('Did Not Meet Expectations');
      expect(descriptorOf(scoredAt(100).percentage).label).toBe('Outstanding');
    },
  );
});
