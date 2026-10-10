/**
 * The API and the frontend both do grade arithmetic: the API computes every subject result
 * (backend/src/utils/grading.js), the frontend the general average of those results, the per-type bars of a
 * subject and the pass/fail line (src/utils/grades.js). This test runs one fixed table through both sides
 * and expects the same numbers, so a change to the rounding, the averaging rule or the passing grade on one
 * side fails here until the other side follows.
 *
 * The backend module is imported by relative path. It imports nothing but constants/shared.js, which is the
 * same file byte for byte on both sides (backend `npm run check:constants`), so this needs neither the
 * database nor the backend's packages, and runs in the frontend suite and its CI job.
 */
import { describe, expect, it } from 'vitest';
import * as api from '../../backend/src/utils/grading.js';
import { COMPONENT_OF_TYPE, GRADING_GROUPS } from '../src/constants/shared';
import {
  averageOf,
  descriptorOf,
  generalAverage,
  isPassing,
  passMarkOf,
  percentageByType,
} from '../src/utils/grades';

/** A grade as GET /grades returns it, the shape the frontend reads. */
const grade = (type, score, maxScore) => ({ score, assessment: { type, maxScore } });

/**
 * The per-type totals the API's summary query hands to subjectResult. MySQL sums DECIMAL scores exactly;
 * sumPoints is the API's own exact sum of 2-decimal points, so it stands in for the query here.
 */
function typeTotalsOf(grades) {
  const byType = new Map();
  for (const { score, assessment } of grades) {
    const total = byType.get(assessment.type) ?? { scores: [], maxes: [] };
    total.scores.push(Number(score));
    total.maxes.push(Number(assessment.maxScore));
    byType.set(assessment.type, total);
  }
  return [...byType].map(([type, total]) => ({
    type,
    totalScore: api.sumPoints(total.scores),
    totalMaxScore: api.sumPoints(total.maxes),
    assessmentsGraded: total.scores.length,
  }));
}

/**
 * One student's class-subjects over two school years, covering every grading method: K-12 in each grading
 * group (one with a component not graded yet), weighted (one with a weighted type not graded yet), on points,
 * a subject with nothing graded, and Math taken in two classes of one year (the student changed class).
 */
const CLASS_SUBJECTS = [
  {
    name: 'Math, 10-A',
    subjectId: 1,
    academicYear: '2026-2027',
    group: 'math_science',
    weights: null,
    grades: [
      grade('quiz', 18, 20),
      grade('quiz', 17, 20),
      grade('assignment', 9, 10),
      grade('project', 42, 50),
      grade('exam', 39, 50),
    ],
  },
  {
    name: 'Math, 10-B after the class change',
    subjectId: 1,
    academicYear: '2026-2027',
    group: 'math_science',
    weights: null,
    grades: [grade('quiz', 12, 20), grade('project', 30, 50), grade('exam', 31, 50)],
  },
  {
    name: 'English, no quarterly assessment yet',
    subjectId: 2,
    academicYear: '2026-2027',
    group: 'languages',
    weights: null,
    grades: [grade('quiz', 7.5, 10), grade('test', 41, 50), grade('project', 88, 100)],
  },
  {
    name: 'MAPEH',
    subjectId: 3,
    academicYear: '2026-2027',
    group: 'mapeh',
    weights: null,
    grades: [
      grade('test', 33.5, 40),
      grade('other', 19, 20),
      grade('project', 45.25, 50),
      grade('exam', 70, 100),
    ],
  },
  {
    name: 'Computer, weighted quiz 20 exam 80',
    subjectId: 4,
    academicYear: '2026-2027',
    group: null,
    weights: { quiz: 20, test: 0, exam: 80, assignment: 0, project: 0, other: 0 },
    grades: [grade('quiz', 9, 10), grade('quiz', 8.25, 10), grade('exam', 56, 80)],
  },
  {
    name: 'Research, weighted, the test not graded yet',
    subjectId: 5,
    academicYear: '2026-2027',
    group: null,
    weights: { quiz: 0, test: 40, exam: 0, assignment: 0, project: 60, other: 0 },
    grades: [grade('project', 37, 50), grade('quiz', 10, 10)],
  },
  {
    name: 'Homeroom, on points',
    subjectId: 6,
    academicYear: '2026-2027',
    group: null,
    weights: null,
    grades: [grade('assignment', 10, 10), grade('other', '4.50', '6.00'), grade('quiz', 2, 3)],
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
    grades: [grade('quiz', 70, 100), grade('exam', 61.5, 80)],
  },
];

/** The API's result of a class-subject. */
const apiResult = (classSubject) =>
  api.subjectResult(typeTotalsOf(classSubject.grades), classSubject.weights, classSubject.group);

/** The rows of GET /grades/summary?groupBy=classSubject that the frontend averages. */
const summaryRows = CLASS_SUBJECTS.map((classSubject) => ({
  subjectId: classSubject.subjectId,
  academicYear: classSubject.academicYear,
  percentage: apiResult(classSubject).percentage,
}));

describe('frontend and API agree on grades', () => {
  it('covers every grading method in the table', () => {
    const methods = new Set(CLASS_SUBJECTS.map((classSubject) => apiResult(classSubject).method));
    expect([...methods].sort()).toEqual(['k12', 'points', 'weighted']);
    const groups = new Set(CLASS_SUBJECTS.map((classSubject) => classSubject.group).filter(Boolean));
    expect([...groups].sort()).toEqual([...GRADING_GROUPS].sort());
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
    ['no results', []],
    ['only subjects without a result', [null, null]],
    ['a mean ending in 5 under floating-point dust', [80.01, 80.02]],
    ['a repeating decimal', [1, 2, 2]],
    ['sums with binary dust', [0.1, 0.2]],
    ['a result of 0', [0, 100]],
    ['K-12 grades with points results', [75, 74.99, 88.83, 60, 100]],
  ])('averages %s the same way', (_label, percentages) => {
    expect(averageOf(percentages)).toBe(api.averageOf(percentages));
    // The same results as separate subjects, then as one subject taken in several classes of a year.
    const separate = percentages.map((percentage, index) => ({
      subjectId: index + 1,
      academicYear: '2026-2027',
      percentage,
    }));
    const oneSubject = separate.map((row) => ({ ...row, subjectId: 1 }));
    expect(generalAverage(separate)).toBe(api.generalAverageOf(separate));
    expect(generalAverage(oneSubject)).toBe(api.generalAverageOf(oneSubject));
  });

  it("draws each assessment type's bar at the figure the API computes for that type", () => {
    for (const classSubject of CLASS_SUBJECTS) {
      const bars = percentageByType(classSubject.grades);
      for (const totals of typeTotalsOf(classSubject.grades)) {
        const label = `${classSubject.name}: ${totals.type}`;
        // On points, one type alone; weighted, one type weighted 100: both are that type's points percentage.
        expect(bars[totals.type], label).toBe(api.subjectResult([totals], null).percentage);
        expect(bars[totals.type], label).toBe(api.subjectResult([totals], { [totals.type]: 100 }).percentage);
      }
    }
  });

  it("lists a K-12 component's grades at the percentage the API gives that component", () => {
    for (const classSubject of CLASS_SUBJECTS.filter((row) => row.group)) {
      // The subject page groups the grades by component (COMPONENT_OF_TYPE) under the API's component figures.
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

  // A subject scored exactly at the frontend's pass mark for its method, in every part, and one hundredth
  // below it. The API's result of the first must pass on the frontend and the second must not.
  it.each([
    ['points', null, null],
    ['weighted', { quiz: 30, exam: 70 }, null],
    ...GRADING_GROUPS.map((group) => ['k12', null, group]),
  ])(
    'puts the pass mark of a subject graded %s where the API passes it (%o, %s)',
    (method, weights, group) => {
      const scoredAt = (percent) =>
        api.subjectResult(
          typeTotalsOf([
            grade('quiz', percent, 100),
            grade('project', percent, 100),
            grade('exam', percent, 100),
          ]),
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
