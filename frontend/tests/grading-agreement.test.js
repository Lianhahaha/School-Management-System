/**
 * The API and the frontend both do grade arithmetic: the API computes every quarterly grade and each
 * class-subject's semester and school year grades (backend/src/utils/grading.js), the frontend what spans
 * several summary rows (a subject's grade over two classes of a year, the general average) and the pass/fail
 * line (src/utils/grades.js). This test runs one fixed table through both sides and expects the same numbers,
 * so a change to the rounding, the quarter, semester or averaging rule or the passing grade on one side fails
 * here until the other side follows.
 *
 * The frontend is fed what the API returns for the same grades: the rows of
 * GET /grades/summary?groupBy=classSubject&semester=sem1 and ...=sem2 (the rows of a semester with no graded
 * quarter are missing, as in the API), each tagged with its semester. The backend side works from its own
 * unfiltered results, which hold every semester's quarters.
 *
 * The backend module is imported by relative path. It imports nothing but constants/shared.js, which is the
 * same file byte for byte on both sides (backend `npm run check:constants`), so this needs neither the
 * database nor the backend's packages, and runs in the frontend suite and its CI job.
 */
import { describe, expect, it } from 'vitest';
import * as api from '../../backend/src/utils/grading.js';
import { GRADING_GROUPS, SEMESTERS, TERMS } from '../src/constants/shared';
import {
  averageOf,
  descriptorOf,
  finalGradeOf,
  generalAverage,
  groupBy,
  isPassing,
  passMarkOf,
  subjectFinalGrade,
  subjectQuarters,
  subjectRows,
  subjectSemesters,
} from '../src/utils/grades';

/**
 * A grade as GET /grades returns it, the shape the frontend reads, in a quarter (term1 to term4) of a
 * semester (sem1 or sem2).
 */
const grade = (type, score, maxScore, term = 'term1', semester = 'sem1') => ({
  score,
  assessment: { type, maxScore, term, semester },
});

/**
 * The totals the API's summary query hands to finalResult: per semester, quarter and assessment type, or with
 * `perQuarter: false` per type over every period (the old whole-year rule). MySQL sums DECIMAL scores
 * exactly; sumPoints is the API's own exact sum of 2-decimal points, so it stands in for the query here.
 */
function typeTotalsOf(grades, { perQuarter = true } = {}) {
  const groups = new Map();
  for (const { score, assessment } of grades) {
    const key = perQuarter ? `${assessment.semester}|${assessment.term}|${assessment.type}` : assessment.type;
    const total = groups.get(key) ?? {
      semester: assessment.semester,
      term: assessment.term,
      type: assessment.type,
      scores: [],
      maxes: [],
    };
    total.scores.push(Number(score));
    total.maxes.push(Number(assessment.maxScore));
    groups.set(key, total);
  }
  return [...groups.values()].map(({ semester, term, type, scores, maxes }) => ({
    ...(perQuarter && { semester, term }),
    type,
    totalScore: api.sumPoints(scores),
    totalMaxScore: api.sumPoints(maxes),
    assessmentsGraded: scores.length,
  }));
}

/**
 * One student's class-subjects over three school years, covering every grading method: K-12 in each grading
 * group (one with a component not graded yet; the Senior High groups in the student's Grade 11 year),
 * weighted (one with a weighted type not graded yet, and a
 * quarter graded only in a type weighted 0), on points, a subject with nothing graded, and Math taken in two
 * classes of one year (the student changed class in the 2nd Quarter of the 1st Semester, so that quarter has
 * grades in both, and the 2nd Semester's 1st Quarter too). The grades are spread over the quarters of both
 * semesters, with gaps and with a different number of graded quarters in each semester, so the semester rule
 * differs from averaging the quarters of the year and from grading the year at once.
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
      grade('quiz', 15, 20, 'term1', 'sem2'),
      grade('exam', 40, 50, 'term1', 'sem2'),
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
      grade('project', 36, 50, 'term1', 'sem2'),
      grade('exam', 31, 50, 'term4', 'sem2'),
    ],
  },
  {
    name: 'English, no quarterly assessment yet, the 2nd Semester not started',
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
    name: 'MAPEH, nothing in the 2nd Quarter of the 1st Semester',
    subjectId: 3,
    academicYear: '2026-2027',
    group: 'mapeh',
    weights: null,
    grades: [
      grade('test', 33.5, 40, 'term1'),
      grade('other', 19, 20, 'term1'),
      grade('project', 45.25, 50, 'term3'),
      grade('exam', 70, 100, 'term4', 'sem2'),
    ],
  },
  {
    name: 'Computer, weighted quiz 20 exam 80',
    subjectId: 4,
    academicYear: '2026-2027',
    group: null,
    weights: { quiz: 20, test: 0, exam: 80, assignment: 0, project: 0, other: 0 },
    grades: [
      grade('quiz', 9, 10, 'term1'),
      grade('quiz', 8.25, 10, 'term2'),
      grade('exam', 56, 80, 'term2'),
      grade('quiz', 6, 10, 'term1', 'sem2'),
    ],
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
      grade('quiz', 2, 3, 'term4', 'sem2'),
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
    grades: [grade('quiz', 70, 100, 'term1'), grade('exam', 61.5, 80, 'term3', 'sem2')],
  },
  {
    name: 'Oral Communication, Grade 11 core, both semesters',
    subjectId: 8,
    academicYear: '2027-2028',
    group: 'shs_core',
    weights: null,
    grades: [
      grade('quiz', 14, 20, 'term1'),
      grade('project', 40, 50, 'term1'),
      grade('exam', 30, 50, 'term1'),
      grade('assignment', 17.5, 20, 'term2'),
      grade('exam', 44, 50, 'term2'),
      grade('test', 33, 40, 'term1', 'sem2'),
      grade('project', 47, 50, 'term1', 'sem2'),
    ],
  },
  {
    name: 'Pre-Calculus, Grade 11 academic track, no performance task yet',
    subjectId: 9,
    academicYear: '2027-2028',
    group: 'shs_academic',
    weights: null,
    grades: [grade('quiz', 9, 10, 'term1'), grade('exam', 27.5, 40, 'term1'), grade('quiz', 6, 10, 'term3')],
  },
  {
    name: 'Work Immersion, Grade 11 academic track',
    subjectId: 10,
    academicYear: '2027-2028',
    group: 'shs_immersion',
    weights: null,
    grades: [
      grade('assignment', 8, 10, 'term1', 'sem2'),
      grade('other', 88, 100, 'term1', 'sem2'),
      grade('exam', 41, 50, 'term2', 'sem2'),
    ],
  },
  {
    name: 'Cookery, Grade 11 TVL, a gap quarter',
    subjectId: 11,
    academicYear: '2027-2028',
    group: 'shs_tvl',
    weights: null,
    grades: [
      grade('project', 36, 40, 'term1'),
      grade('quiz', 13, 20, 'term1'),
      grade('exam', 52, 60, 'term3'),
      grade('project', 19, 20, 'term3'),
    ],
  },
];

const gradesOf = (classSubject, semester) =>
  classSubject.grades.filter((entry) => entry.assessment.semester === semester);

/** The API's result of a class-subject over the school year: its semesters, quarters and year grade. */
const apiResult = (classSubject) =>
  api.finalResult(typeTotalsOf(classSubject.grades), classSubject.weights, classSubject.group);

/** The API's result of a class-subject scoped to one semester (the semester filter of the summary). */
const apiSemesterResult = (classSubject, semester) =>
  api.finalResult(
    typeTotalsOf(gradesOf(classSubject, semester)),
    classSubject.weights,
    classSubject.group,
    semester,
  );

/** The API's result under the old rule, every assessment of the year graded together. */
const wholeYearResult = (classSubject) =>
  api.subjectResult(
    typeTotalsOf(classSubject.grades, { perQuarter: false }),
    classSubject.weights,
    classSubject.group,
  );

/** What the API holds of each class-subject with grades over the whole year: the input of its own merges. */
const backendRows = CLASS_SUBJECTS.filter((classSubject) => classSubject.grades.length).map(
  (classSubject) => ({
    subjectId: classSubject.subjectId,
    academicYear: classSubject.academicYear,
    ...apiResult(classSubject),
  }),
);

/**
 * The rows of GET /grades/summary?groupBy=classSubject&semester= that the frontend averages, the rows of both
 * semesters together, tagged with their semester. A class-subject with nothing graded in a semester has no
 * row in it, as in the API.
 */
const summaryRows = CLASS_SUBJECTS.flatMap((classSubject) =>
  SEMESTERS.filter((semester) => gradesOf(classSubject, semester).length).map((semester) => {
    const { percentage, method, quarters } = apiSemesterResult(classSubject, semester);
    return {
      subjectId: classSubject.subjectId,
      academicYear: classSubject.academicYear,
      semester,
      percentage,
      method,
      quarters,
    };
  }),
);

/** The class-subjects' own (unfiltered) results, one per class-subject, with their name. */
const yearResults = CLASS_SUBJECTS.map((classSubject) => [classSubject, apiResult(classSubject)]);

/** Quarterly grades in TERMS order: [88, null, 90, null] -> { term1: 88, term2: null, ... }. */
const quartersOf = (values) => Object.fromEntries(TERMS.map((term, index) => [term, values[index] ?? null]));

/** A summary row of one semester as the frontend reads it, and the API's matching unfiltered result. */
const frontendRow = (semester, values, method) => ({
  subjectId: 1,
  academicYear: '2026-2027',
  semester,
  method,
  quarters: quartersOf(values),
});
const backendRow = (sem1, sem2, method) => ({
  subjectId: 1,
  academicYear: '2026-2027',
  method,
  periods: { sem1: quartersOf(sem1), sem2: quartersOf(sem2) },
});

describe('frontend and API agree on grades', () => {
  it('covers every grading method in the table', () => {
    const methods = new Set(CLASS_SUBJECTS.map((classSubject) => apiResult(classSubject).method));
    expect([...methods].sort()).toEqual(['k12', 'points', 'weighted']);
    const groups = new Set(CLASS_SUBJECTS.map((classSubject) => classSubject.group).filter(Boolean));
    expect([...groups].sort()).toEqual([...GRADING_GROUPS].sort());
    // The Senior High weights are the ones applied: the core subject's 1st Quarter is written work 70,
    // performance 80 and quarterly 60, an initial grade of 72.5 (25 / 50 / 25), transmuted to 82.
    const core = CLASS_SUBJECTS.find((classSubject) => classSubject.group === 'shs_core');
    expect(apiResult(core).periods.sem1.term1).toBe(82);
  });

  it('covers the period cases: the old rules disagreeing, a gap quarter and a semester without a grade', () => {
    // In every method some subject's year grade differs from grading its whole year at once, and from the
    // mean of its quarters (the semesters have different numbers of graded quarters).
    for (const method of ['k12', 'points', 'weighted']) {
      const ofMethod = yearResults.filter(([, result]) => result.method === method);
      expect(
        ofMethod.some(
          ([classSubject, result]) => result.percentage !== wholeYearResult(classSubject).percentage,
        ),
        `${method} against the whole year`,
      ).toBe(true);
      expect(
        ofMethod.some(([, result]) => {
          const quarterGrades = SEMESTERS.flatMap((semester) => Object.values(result.periods[semester]));
          return result.percentage !== finalGradeOf(quarterGrades, method);
        }),
        `${method} against the mean of the quarters`,
      ).toBe(true);
    }
    const resultOf = (name) => yearResults.find(([classSubject]) => classSubject.name.startsWith(name))[1];
    // A quarter with nothing graded between graded ones (MAPEH's 2nd), and one graded only in a type weighted
    // 0 (Research's 2nd), which has no grade either.
    expect(resultOf('MAPEH').periods.sem1.term2).toBeNull();
    expect(resultOf('MAPEH').periods.sem1.term3).not.toBeNull();
    expect(resultOf('Research').periods.sem1).toEqual(quartersOf([74]));
    // A semester without any graded quarter is left out: English has only the 1st Semester.
    expect(resultOf('English').semesters.sem2).toBeNull();
    expect(resultOf('English').percentage).toBe(resultOf('English').semesters.sem1);
    // And one with both semesters graded, whose year grade is the mean of the two.
    const math = resultOf('Math, 10-A');
    expect(math.semesters.sem1).not.toBeNull();
    expect(math.semesters.sem2).not.toBeNull();
    expect(math.percentage).toBe(finalGradeOf(Object.values(math.semesters), 'k12'));
  });

  it("gives each class-subject's semester filter the grade the unfiltered result holds for that semester", () => {
    for (const [classSubject, result] of yearResults) {
      for (const semester of SEMESTERS) {
        const scoped = apiSemesterResult(classSubject, semester);
        expect(scoped.percentage, `${classSubject.name} ${semester}`).toBe(result.semesters[semester]);
        expect(scoped.quarters, `${classSubject.name} ${semester}`).toEqual(result.periods[semester]);
      }
    }
  });

  it('gives each subject the same quarterly, semester and year grades over its classes of a year', () => {
    const frontend = groupBy(summaryRows, (row) => `${row.subjectId}:${row.academicYear}`);
    const backend = groupBy(backendRows, (row) => `${row.subjectId}:${row.academicYear}`);
    expect([...backend.values()].some((rows) => rows.length > 1)).toBe(true);
    for (const [key, rows] of backend) {
      for (const semester of SEMESTERS) {
        const semesterRows = frontend.get(key).filter((row) => row.semester === semester);
        if (semesterRows.length) {
          expect(subjectQuarters(semesterRows), `${key} ${semester}`).toEqual(
            api.subjectQuarters(rows, semester),
          );
        }
      }
      expect(subjectSemesters(frontend.get(key)), key).toEqual(api.subjectSemesters(rows));
      expect(subjectFinalGrade(frontend.get(key)), key).toBe(api.subjectFinalGrade(rows));
      if (rows.length === 1) {
        // One class: the grade the API's own summary row gives for the whole year.
        expect(subjectFinalGrade(frontend.get(key)), key).toBe(rows[0].percentage);
        expect(subjectSemesters(frontend.get(key)), key).toEqual(rows[0].semesters);
      }
    }
    // Math of 2026-2027: 1st Semester Q1 from 10-A, Q2 graded in both classes, Q3 from 10-B; 2nd Semester Q1
    // graded in both classes and Q4 from 10-B.
    const math = api.subjectSemesters(backend.get('1:2026-2027'));
    expect(math.sem1).not.toBeNull();
    expect(math.sem2).not.toBeNull();
    const mathQuarters = api.subjectQuarters(backend.get('1:2026-2027'), 'sem1');
    expect(
      [mathQuarters.term1, mathQuarters.term2, mathQuarters.term3].every((value) => value !== null),
    ).toBe(true);
  });

  it("gives each subject's row the quarterly, semester and year grades the API merges for it", () => {
    // My grades, the report card and the grade cards fetch each semester's summary and put the rows together
    // per subject and school year (subjectRows) instead of asking the API for the year, which would carry no
    // quarters: a subject taken in two classes is one row, graded as the general average grades it.
    const rows = CLASS_SUBJECTS.flatMap((classSubject, index) =>
      SEMESTERS.filter((semester) => gradesOf(classSubject, semester).length).map((semester) => {
        const { percentage, method, quarters } = apiSemesterResult(classSubject, semester);
        return {
          classSubjectId: index,
          subjectId: classSubject.subjectId,
          subjectName: classSubject.name,
          className: classSubject.name,
          academicYear: classSubject.academicYear,
          semester,
          percentage,
          method,
          quarters,
        };
      }),
    );
    const backend = groupBy(backendRows, (row) => `${row.subjectId}:${row.academicYear}`);
    const yearRows = subjectRows(rows);
    expect(yearRows.map((row) => row.key).sort()).toEqual([...backend.keys()].sort());
    for (const row of yearRows) {
      expect(row.semesters, row.key).toEqual(api.subjectSemesters(backend.get(row.key)));
      expect(row.percentage, row.key).toBe(api.subjectFinalGrade(backend.get(row.key)));
    }
    // Math of 2026-2027 was taken in two classes: one row, with both classes named.
    const math = yearRows.find((row) => row.key === '1:2026-2027');
    expect(math.classSubjectIds).toHaveLength(2);
    expect(math.className).toBe('Math, 10-A / Math, 10-B after the class change');
    // Some subject has one semester only, and one has both: the two shapes of a year row.
    expect(yearRows.some((row) => row.semesters.sem2 === null)).toBe(true);
    expect(yearRows.some((row) => row.semesters.sem1 !== null && row.semesters.sem2 !== null)).toBe(true);

    // The rows of one semester alone: each subject's quarters and semester grade, as the API merges them.
    for (const semester of SEMESTERS) {
      for (const row of subjectRows(rows.filter((candidate) => candidate.semester === semester))) {
        expect(row.quarters, `${row.key} ${semester}`).toEqual(
          api.subjectQuarters(backend.get(row.key), semester),
        );
        expect(row.percentage, `${row.key} ${semester}`).toBe(
          api.subjectSemesters(backend.get(row.key))[semester],
        );
      }
    }
  });

  it('computes the same general average over every method, per year, per semester and overall', () => {
    for (const year of ['2025-2026', '2026-2027', '2027-2028']) {
      const rows = summaryRows.filter((row) => row.academicYear === year);
      const results = backendRows.filter((row) => row.academicYear === year);
      expect(generalAverage(rows), year).toBe(api.generalAverageOf(results));
    }
    expect(generalAverage(summaryRows)).toBe(api.generalAverageOf(backendRows));
    expect(generalAverage(summaryRows)).not.toBeNull();

    // One semester: the frontend's rows of that semester against the API's results scoped to it.
    for (const semester of SEMESTERS) {
      const scoped = CLASS_SUBJECTS.filter((classSubject) => gradesOf(classSubject, semester).length).map(
        (classSubject) => ({
          subjectId: classSubject.subjectId,
          academicYear: classSubject.academicYear,
          ...apiSemesterResult(classSubject, semester),
        }),
      );
      const rows = summaryRows.filter((row) => row.semester === semester);
      expect(generalAverage(rows), semester).toBe(api.generalAverageOf(scoped));
      expect(generalAverage(rows), semester).not.toBeNull();
    }
  });

  it.each([
    ['K-12, two quarters ending in .5', [88, 89, null, null], [], 'k12'],
    ['K-12, a third', [88, 89, 89, null], [], 'k12'],
    ['K-12, just under the passing grade', [74, 74, 74, 75], [], 'k12'],
    ['K-12, half up to the passing grade', [74, 74, 75, 75], [], 'k12'],
    ['K-12, a gap quarter', [90, null, 85, 80], [], 'k12'],
    ['K-12, a semester of 88.5 and one of 80', [88, 89], [80], 'k12'],
    ['K-12, only the 2nd Semester graded', [], [90, 85], 'k12'],
    ['K-12, semesters of different lengths', [60, 80, 100], [90], 'k12'],
    ['points, a mean ending in 5 under floating-point dust', [80.01, 80.02, null, null], [], 'points'],
    ['points, two semesters ending in 5', [80.01, 80.02], [80.04], 'points'],
    ['weighted, a repeating decimal', [90, 85, 70, null], [60, null, 50], 'weighted'],
    ['no quarter graded', [null, null, null, null], [], 'k12'],
  ])('averages the quarterly and semester grades of %s the same way', (_label, sem1, sem2, method) => {
    expect(finalGradeOf(sem1, method)).toBe(api.finalGradeOf(sem1, method));
    const frontendRows = [frontendRow('sem1', sem1, method), frontendRow('sem2', sem2, method)];
    const result = backendRow(sem1, sem2, method);
    expect(subjectSemesters(frontendRows)).toEqual(api.subjectSemesters([result]));
    expect(subjectFinalGrade(frontendRows)).toBe(api.subjectFinalGrade([result]));
    expect(generalAverage(frontendRows)).toBe(api.generalAverageOf([result]));
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
    // The same results as separate subjects graded in the 1st Quarter of the 1st Semester, then as one
    // subject taken in several classes of a year (their 1st Quarters averaged).
    const separate = percentages.map((percentage, index) => ({
      ...frontendRow('sem1', [percentage], 'points'),
      subjectId: index + 1,
    }));
    const separateResults = percentages.map((percentage, index) => ({
      ...backendRow([percentage], [], 'points'),
      subjectId: index + 1,
    }));
    const oneSubject = separate.map((row) => ({ ...row, subjectId: 1 }));
    const oneSubjectResults = separateResults.map((row) => ({ ...row, subjectId: 1 }));
    expect(generalAverage(separate)).toBe(api.generalAverageOf(separateResults));
    expect(generalAverage(oneSubject)).toBe(api.generalAverageOf(oneSubjectResults));
  });

  // A subject scored exactly at the frontend's pass mark for its method, in every part of every quarter of
  // both semesters, and one hundredth below it. The API's year grade of the first must pass on the frontend
  // and the second must not.
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
            SEMESTERS.flatMap((semester) =>
              TERMS.flatMap((term) => [
                grade('quiz', percent, 100, term, semester),
                grade('project', percent, 100, term, semester),
                grade('exam', percent, 100, term, semester),
              ]),
            ),
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
