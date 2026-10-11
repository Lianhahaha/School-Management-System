import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  averageOf,
  finalGradeOf,
  finalResult,
  generalAverageOf,
  subjectFinalGrade,
  subjectQuarters,
  subjectResult,
  subjectSemesters,
  subjectYearResults,
  transmute,
} from '../src/utils/grading.js';

/** The quarters of a semester: Q1 to Q4, null for a quarter with nothing graded. */
const quarters = (term1 = null, term2 = null, term3 = null, term4 = null) => ({ term1, term2, term3, term4 });

/**
 * A class-subject result as the summary holds it: its method and the quarterly grades of each semester
 * (`periods`). The quarters given first are the 1st Semester's, so a result with only those is a school year in
 * which only the 1st Semester has been graded.
 */
const classResult = (subjectId, academicYear, method, sem1 = quarters(), sem2 = quarters()) => ({
  subjectId,
  academicYear,
  method,
  periods: { sem1, sem2 },
});

describe('grading arithmetic', () => {
  it('counts a subject taken in two classes of one year once in the general average', () => {
    // Moved from 10-A to 10-B at the half year: Math 60 in Q1 and Q2 in 10-A, 90 in Q3 and Q4 in 10-B;
    // English 80.
    const results = [
      classResult(1, '2026-2027', 'points', quarters(60, 60)),
      classResult(1, '2026-2027', 'points', quarters(null, null, 90, 90)),
      classResult(2, '2026-2027', 'points', quarters(80, 80, 80, 80)),
    ];
    assert.equal(generalAverageOf(results), 77.5); // (75 + 80) / 2, not (60 + 90 + 80) / 3
  });

  it('keeps the same subject of different years apart, and skips subjects without a result', () => {
    const results = [
      classResult(1, '2025-2026', 'points', quarters(70)),
      classResult(1, '2026-2027', 'points', quarters(90)),
      classResult(2, '2026-2027', 'points', quarters()),
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

describe('quarterly grades and the final grade (DepEd Order 8 s. 2015)', () => {
  /** Graded points of one quarter and assessment type, as the summary query returns them. */
  const totals = (term, type, totalScore, totalMaxScore, semester = 'sem1') => ({
    semester,
    term,
    type,
    totalScore,
    totalMaxScore,
    assessmentsGraded: 1,
  });
  /** The same rows with semester and quarter dropped: what the old whole-year rule graded together. */
  const wholeYear = (rows) => rows.map(({ term: _term, semester: _semester, ...row }) => row);

  // Math and Science (written 40, performance 40, quarterly 20).
  // Q1: written 18/20 = 90, performance 40/50 = 80, quarterly 45/50 = 90: initial 86, transmuted 91.
  // Q2: written 10/20 = 50, performance 30/50 = 60, quarterly 20/50 = 40: initial 52, transmuted 73.
  const k12Rows = [
    totals('term1', 'quiz', 18, 20),
    totals('term1', 'project', 40, 50),
    totals('term1', 'exam', 45, 50),
    totals('term2', 'quiz', 10, 20),
    totals('term2', 'project', 30, 50),
    totals('term2', 'exam', 20, 50),
  ];

  it('grades each K-12 quarter on its own and averages the quarterly grades', () => {
    const final = finalResult(k12Rows, null, 'math_science');
    assert.deepEqual(final.periods.sem1, quarters(91, 73));
    assert.deepEqual(final.semesters, { sem1: 82, sem2: null });
    assert.equal(final.percentage, 82); // (91 + 73) / 2, the one semester graded
    assert.equal(final.method, 'k12');
    // The old rule transmuted the whole year at once: written 28/40 = 70, performance 70, quarterly 65 give an
    // initial grade of 69, transmuted to 80.
    assert.equal(subjectResult(wholeYear(k12Rows), null, 'math_science').percentage, 80);
    // Each quarter was transmuted on its own, so no single initial grade leads to 82.
    assert.equal(final.initialGrade, null);
    // The components still show the whole year's scores, for the bars of the subject page.
    assert.deepEqual(
      final.components.map((part) => [part.component, part.percentage, part.assessmentsGraded]),
      [
        ['written', 70, 2],
        ['performance', 70, 2],
        ['quarterly', 65, 2],
      ],
    );
  });

  it('leaves out a quarter with nothing graded: the final grade is the average so far', () => {
    // Nothing in Q3; Q4 has only a quiz, 19/20 = written 95, so its initial grade is 95 (the other components
    // are left out within the quarter), transmuted 96.
    const final = finalResult([...k12Rows, totals('term4', 'quiz', 19, 20)], null, 'math_science', 'sem1');
    assert.deepEqual(final.quarters, quarters(91, 73, null, 96));
    assert.equal(final.percentage, 87); // (91 + 73 + 96) / 3 = 86.67, a whole number
    assert.equal(finalResult([], null, 'math_science').percentage, null);
    assert.deepEqual(finalResult([], null, 'math_science', 'sem1').quarters, quarters());
  });

  it("keeps the one graded quarter's initial grade, so a single quarter reads as before", () => {
    const q1 = k12Rows.filter((row) => row.term === 'term1');
    const final = finalResult(q1, null, 'math_science');
    const quarter = subjectResult(wholeYear(q1), null, 'math_science');
    assert.equal(final.percentage, 91);
    assert.equal(final.initialGrade, 86);
    assert.deepEqual(
      { percentage: final.percentage, initialGrade: final.initialGrade, components: final.components },
      { percentage: quarter.percentage, initialGrade: quarter.initialGrade, components: quarter.components },
    );
  });

  it('averages the quarters of a subject on points too, rather than pooling the points of the year', () => {
    // Q1 exam 95/100 = 95, Q2 quiz 2/10 = 20: (95 + 20) / 2 = 57.5. The year's points, 97/110 = 88.18,
    // would let one big exam outweigh a whole quarter.
    const rows = [totals('term1', 'exam', 95, 100), totals('term2', 'quiz', 2, 10)];
    const final = finalResult(rows, null);
    assert.deepEqual(final.periods.sem1, quarters(95, 20));
    assert.equal(final.percentage, 57.5);
    assert.equal(final.initialGrade, 57.5);
    assert.equal(final.method, 'points');
    assert.equal(final.components, null);
    assert.equal(subjectResult(wholeYear(rows), null).percentage, 88.18);
  });

  it('averages the quarters of a weighted subject, leaving out a quarter graded only in types weighted 0', () => {
    const weights = { quiz: 50, exam: 50 };
    const rows = [
      totals('term1', 'quiz', 10, 10), // 100
      totals('term1', 'exam', 40, 80), // 50: Q1 = 75
      totals('term2', 'quiz', 6, 10), // Q2 = 60 (the exam not graded yet in Q2)
      totals('term3', 'test', 5, 10), // tests weigh 0: Q3 has no grade
    ];
    const final = finalResult(rows, weights);
    assert.deepEqual(final.periods.sem1, quarters(75, 60));
    assert.equal(final.percentage, 67.5);
    assert.equal(final.method, 'weighted');
    // The whole year at once: quiz 16/20 = 80 and exam 50 weigh 65.
    const pooled = [
      totals('all', 'quiz', 16, 20),
      totals('all', 'exam', 40, 80),
      totals('all', 'test', 5, 10),
    ];
    assert.equal(subjectResult(wholeYear(pooled), weights).percentage, 65);
  });

  it('rounds a K-12 final grade half up to a whole number, and keeps 2 decimals otherwise', () => {
    assert.equal(finalGradeOf([88, 89, null, null], 'k12'), 89); // 88.5
    assert.equal(finalGradeOf([88, 89, 89], 'k12'), 89); // 88.67
    assert.equal(finalGradeOf([74, 74, 74, 75], 'k12'), 74); // 74.25
    assert.equal(finalGradeOf([74, 74, 75, 75], 'k12'), 75); // 74.5 passes
    assert.equal(finalGradeOf([80, 81, 81, 81], 'k12'), 81); // 80.75
    assert.equal(finalGradeOf([80.01, 80.02], 'points'), 80.02); // 80.015 despite floating-point dust
    assert.equal(finalGradeOf([90, 85, 70], 'weighted'), 81.67);
    assert.equal(finalGradeOf([null, undefined], 'k12'), null);
    assert.equal(finalGradeOf([], 'points'), null);
  });

  it('puts the quarters of a subject taken in two classes together', () => {
    // Q1 in 10-A, then Q2 to Q4 in 10-B: (70 + 80 + 84 + 86) / 4 = 80. The mean of the two class results,
    // (70 + 83) / 2 = 76.5, would count the one quarter in 10-A as much as the three in 10-B.
    const moved = [
      classResult(1, '2026-2027', 'k12', quarters(70)),
      classResult(1, '2026-2027', 'k12', quarters(null, 80, 84, 86)),
    ];
    assert.deepEqual(subjectQuarters(moved, 'sem1'), quarters(70, 80, 84, 86));
    assert.equal(subjectFinalGrade(moved), 80);
    assert.equal(subjectFinalGrade([moved[1]]), 83); // 10-B alone: 83.33
    assert.equal(generalAverageOf([...moved, classResult(2, '2026-2027', 'k12', quarters(91))]), 85.5);

    // A quarter graded in both classes (the move came mid-quarter) averages them the same way: Q2 is
    // (80 + 85) / 2 = 82.5, a whole 83, and the final grade (88 + 83) / 2 = 85.5, a whole 86.
    const midQuarter = [
      classResult(1, '2026-2027', 'k12', quarters(88, 80)),
      classResult(1, '2026-2027', 'k12', quarters(null, 85)),
    ];
    assert.equal(subjectFinalGrade(midQuarter), 86);
  });
});

describe('semesters and the school year grade', () => {
  /** Graded points of one quarter of one semester and assessment type, as the summary query returns them. */
  const totals = (semester, term, type, totalScore, totalMaxScore) => ({
    semester,
    term,
    type,
    totalScore,
    totalMaxScore,
    assessmentsGraded: 1,
  });

  it('grades a semester as the mean of its graded quarters, leaving the other semester out', () => {
    // 1st Semester: Q1 exam 80/100, Q2 exam 90/100, nothing in Q3 or Q4; nothing in the 2nd Semester.
    const rows = [totals('sem1', 'term1', 'exam', 80, 100), totals('sem1', 'term2', 'exam', 90, 100)];

    const year = finalResult(rows, null);
    assert.deepEqual(year.semesters, { sem1: 85, sem2: null });
    assert.equal(year.percentage, 85, 'with one semester graded, the year is that semester');
    assert.equal(year.quarters, undefined, 'a school year has no single set of quarters');

    const first = finalResult(rows, null, null, 'sem1');
    assert.deepEqual(first.quarters, quarters(80, 90));
    assert.equal(first.percentage, 85);
    assert.equal(first.semesters, undefined);

    const second = finalResult(rows, null, null, 'sem2');
    assert.deepEqual(second.quarters, quarters());
    assert.equal(second.percentage, null);
  });

  it('averages the semesters, not all the quarters, when they have a different number of graded quarters', () => {
    // 1st Semester: Q1 60, Q2 80, Q3 100 (mean 80); 2nd Semester: Q1 90. The mean of the four quarters would
    // be 82.5; each semester counts once, so the year is (80 + 90) / 2.
    const rows = [
      totals('sem1', 'term1', 'exam', 60, 100),
      totals('sem1', 'term2', 'exam', 80, 100),
      totals('sem1', 'term3', 'exam', 100, 100),
      totals('sem2', 'term1', 'exam', 90, 100),
    ];
    const year = finalResult(rows, null);
    assert.deepEqual(year.semesters, { sem1: 80, sem2: 90 });
    assert.equal(year.percentage, 85);
    assert.deepEqual(year.periods, {
      sem1: quarters(60, 80, 100),
      sem2: quarters(90),
    });
    assert.equal(finalGradeOf([60, 80, 100, 90], 'points'), 82.5, 'what the old rule gave');
    // The semester filter gives each semester's own grade.
    assert.equal(finalResult(rows, null, null, 'sem1').percentage, 80);
    assert.equal(finalResult(rows, null, null, 'sem2').percentage, 90);
  });

  it('rounds a K-12 semester to a whole number first, then averages the semester grades', () => {
    // Quarters 88 and 89 make a semester of 88.5, a whole 89; the other semester is 80. The year is
    // (89 + 80) / 2 = 84.5, a whole 85. Averaged unrounded it would be 84.25 (84); over the three quarters
    // 85.67 (86).
    const results = [classResult(1, '2026-2027', 'k12', quarters(88, 89), quarters(80))];
    assert.deepEqual(subjectSemesters(results), { sem1: 89, sem2: 80 });
    assert.equal(subjectFinalGrade(results), 85);
    assert.equal(finalGradeOf([88, 89, 80], 'k12'), 86);
  });

  it('averages the same quarter of both semesters when only that quarter is asked for', () => {
    // The 1st Quarter of each semester: 70 and 90. With `term` alone, the summary's rows hold just those.
    const rows = [totals('sem1', 'term1', 'exam', 70, 100), totals('sem2', 'term1', 'exam', 90, 100)];
    const year = finalResult(rows, null);
    assert.deepEqual(year.semesters, { sem1: 70, sem2: 90 });
    assert.equal(year.percentage, 80);
    assert.equal(year.initialGrade, 80, 'a points result keeps its grade as the initial grade');
  });

  it('keeps one K-12 initial grade only while one quarter of the scope is graded', () => {
    const rows = [totals('sem1', 'term1', 'quiz', 18, 20), totals('sem2', 'term1', 'quiz', 10, 20)];
    // Written work only in each quarter: initial grades 90 and 50, transmuted to 93 and 72 on their own.
    const year = finalResult(rows, null, 'languages');
    assert.equal(year.initialGrade, null, 'two quarters were transmuted, each on its own');
    const first = finalResult(rows, null, 'languages', 'sem1');
    assert.equal(first.initialGrade, 90);
    assert.equal(first.percentage, 93);
    assert.deepEqual(
      first.components.map((part) => [part.component, part.percentage]),
      [
        ['written', 90],
        ['performance', null],
        ['quarterly', null],
      ],
      'the components of a semester count that semester only',
    );
  });

  it('puts the quarters of a student who changed class together per semester and quarter', () => {
    // 10-A: 1st Semester Q1 60, Q2 80. 10-B: 1st Semester Q2 100, Q3 90; 2nd Semester Q1 70.
    // Merged 1st Semester: Q1 60, Q2 (80 + 100) / 2 = 90, Q3 90 -> 80; 2nd Semester 70; year 75.
    // The mean of the two classes' own years, (70 + 82.5) / 2 = 76.25, would be wrong.
    const classA = classResult(1, '2026-2027', 'points', quarters(60, 80));
    const classB = classResult(1, '2026-2027', 'points', quarters(null, 100, 90), quarters(70));
    assert.deepEqual(subjectQuarters([classA, classB], 'sem1'), quarters(60, 90, 90));
    assert.deepEqual(subjectQuarters([classA, classB], 'sem2'), quarters(70));
    assert.deepEqual(subjectSemesters([classA, classB]), { sem1: 80, sem2: 70 });
    assert.equal(subjectFinalGrade([classA, classB]), 75);
    assert.equal(subjectFinalGrade([classA]), 70);
    assert.equal(subjectFinalGrade([classB]), 82.5);

    // One subject of the year, then another: the general average counts the moved subject once.
    const english = classResult(2, '2026-2027', 'points', quarters(90), quarters(80));
    assert.equal(generalAverageOf([classA, classB, english]), 80); // (75 + 85) / 2
    assert.deepEqual(
      subjectYearResults([classA, classB, english]).map(({ subjectId, percentage }) => [
        subjectId,
        percentage,
      ]),
      [
        [1, 75],
        [2, 85],
      ],
    );
  });

  it('gives the general average of one semester from results that hold only that semester', () => {
    // A summary filtered to the 2nd Semester: the 1st Semester's quarters are not in its rows.
    const math = classResult(1, '2026-2027', 'points', quarters(), quarters(60, 80));
    const english = classResult(2, '2026-2027', 'points', quarters(), quarters(90));
    assert.equal(subjectFinalGrade([math]), 70);
    assert.equal(generalAverageOf([math, english]), 80); // (70 + 90) / 2
  });
});
