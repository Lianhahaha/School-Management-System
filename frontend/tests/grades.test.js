import { describe, expect, it } from 'vitest';
import { GRADING_GROUPS } from '../src/constants/shared';
import { GRADING_GROUP_LABELS } from '../src/constants/ui';
import {
  averageOf,
  describeGrading,
  describeQuarters,
  describeSemesters,
  describeWeights,
  descriptorOf,
  finalGradeOf,
  formatPeriod,
  formatResult,
  generalAverage,
  gradedQuarters,
  gradedSemesters,
  groupBy,
  isPassing,
  passMarkOf,
  remarksOf,
  resultWidth,
  subjectFinalGrade,
  subjectQuarters,
  subjectRows,
  subjectSemesters,
  tagSemester,
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

/**
 * A row of GET /grades/summary?groupBy=classSubject&semester= as the averages read it: its quarters, tagged
 * with the semester the request was for (the 1st Semester unless said otherwise).
 */
const subjectRow = (subjectId, academicYear, quarterGrades, method = 'points', semester = 'sem1') => ({
  subjectId,
  academicYear,
  method,
  semester,
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

describe('subjectQuarters, subjectSemesters and subjectFinalGrade', () => {
  it("is a single class's own grade", () => {
    const row = subjectRow(1, '2026-2027', quarters(91, 73, null, 96), 'k12');
    expect(subjectQuarters([row])).toEqual(row.quarters);
    expect(subjectSemesters([row])).toEqual({ sem1: 87, sem2: null }); // 86.67
    expect(subjectFinalGrade([row])).toBe(87); // the one semester graded
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

  it('averages the semester grades that exist, so the semesters weigh the same however many quarters', () => {
    // 1st Semester: Q1 60, Q2 80, Q3 100 (80). 2nd Semester: Q1 90. (80 + 90) / 2 = 85, not the 82.5 of
    // the four quarters.
    const rows = [
      subjectRow(1, '2026-2027', quarters(60, 80, 100)),
      subjectRow(1, '2026-2027', quarters(90), 'points', 'sem2'),
    ];
    expect(subjectSemesters(rows)).toEqual({ sem1: 80, sem2: 90 });
    expect(subjectFinalGrade(rows)).toBe(85);
  });

  it('leaves out a semester that has no row or no graded quarter', () => {
    const first = subjectRow(1, '2026-2027', quarters(88, 90));
    expect(subjectSemesters([first])).toEqual({ sem1: 89, sem2: null });
    expect(subjectFinalGrade([first])).toBe(89);
    const ungradedSecond = subjectRow(1, '2026-2027', quarters(), 'points', 'sem2');
    expect(subjectSemesters([first, ungradedSecond])).toEqual({ sem1: 89, sem2: null });
    expect(subjectFinalGrade([first, ungradedSecond])).toBe(89);
    expect(subjectFinalGrade([ungradedSecond])).toBeNull();
  });

  it('rounds a K-12 semester to a whole number before the semesters are averaged', () => {
    // 88 and 89 make 88.5, a whole 89; with 80 the year is (89 + 80) / 2 = 84.5, a whole 85. Unrounded, it
    // would be 84.25 (84).
    const rows = [
      subjectRow(1, '2026-2027', quarters(88, 89), 'k12'),
      subjectRow(1, '2026-2027', quarters(80), 'k12', 'sem2'),
    ];
    expect(subjectSemesters(rows)).toEqual({ sem1: 89, sem2: 80 });
    expect(subjectFinalGrade(rows)).toBe(85);
  });

  it('puts the quarters of two classes together per semester and quarter', () => {
    // 10-A: 1st Semester Q1 60, Q2 80. 10-B: 1st Semester Q2 100, Q3 90; 2nd Semester Q1 70.
    // 1st Semester: Q1 60, Q2 (80 + 100) / 2 = 90, Q3 90 -> 80; 2nd Semester 70; year 75.
    const rows = [
      subjectRow(1, '2026-2027', quarters(60, 80)),
      subjectRow(1, '2026-2027', quarters(null, 100, 90)),
      subjectRow(1, '2026-2027', quarters(), 'points', 'sem2'),
      subjectRow(1, '2026-2027', quarters(70), 'points', 'sem2'),
    ];
    expect(subjectSemesters(rows)).toEqual({ sem1: 80, sem2: 70 });
    expect(subjectFinalGrade(rows)).toBe(75);
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

describe('gradedSemesters and describeSemesters', () => {
  it('lists the semesters with a grade, in order', () => {
    const row = { semesters: { sem1: 88, sem2: 90.5 } };
    expect(gradedSemesters(row)).toEqual(['sem1', 'sem2']);
    expect(describeSemesters(row)).toBe('1st Semester 88, 2nd Semester 90.5');
    expect(describeSemesters({ semesters: { sem1: null, sem2: 74 } })).toBe('2nd Semester 74');
    expect(gradedSemesters({ semesters: { sem1: null, sem2: null } })).toEqual([]);
    expect(gradedSemesters({})).toEqual([]);
  });
});

describe('formatPeriod', () => {
  it('writes the semester and the quarter within it, short', () => {
    expect(formatPeriod('sem1', 'term1')).toBe('1st Sem · Q1');
    expect(formatPeriod('sem1', 'term4')).toBe('1st Sem · Q4');
    expect(formatPeriod('sem2', 'term2')).toBe('2nd Sem · Q2');
  });
});

describe('tagSemester', () => {
  it('copies the rows with the semester they were fetched for and leaves the originals alone', () => {
    const rows = [{ classSubjectId: 1, quarters: quarters(80) }];
    const tagged = tagSemester(rows, 'sem2');
    expect(tagged).toEqual([{ classSubjectId: 1, quarters: quarters(80), semester: 'sem2' }]);
    expect(rows[0]).not.toHaveProperty('semester');
  });
});

describe('subjectRows', () => {
  /** A tagged summary row of one class-subject in one semester. */
  const classSubjectRow = (classSubjectId, semester, quarterGrades, extra = {}) => ({
    classSubjectId,
    subjectId: extra.subjectId ?? classSubjectId,
    subjectName: extra.subjectName ?? `Subject ${classSubjectId}`,
    className: extra.className ?? '10-A',
    academicYear: extra.academicYear ?? '2026-2027',
    method: extra.method ?? 'points',
    gradingGroup: null,
    gradeWeights: null,
    semester,
    quarters: quarterGrades,
    percentage: finalGradeOf(Object.values(quarterGrades), extra.method ?? 'points'),
    assessmentsGraded: 4,
  });

  it("puts a class-subject's two semesters in one row with its grade of the year", () => {
    // 1st Semester Q1 60, Q2 80, Q3 100 (80); 2nd Semester Q1 90. The year is (80 + 90) / 2, not the mean of the
    // four quarters.
    const [row] = subjectRows([
      classSubjectRow(1, 'sem1', quarters(60, 80, 100)),
      classSubjectRow(1, 'sem2', quarters(90)),
    ]);
    expect(row.semesters).toEqual({ sem1: 80, sem2: 90 });
    expect(row.percentage).toBe(85);
    expect(row).toMatchObject({
      key: '1:2026-2027',
      subjectId: 1,
      classSubjectIds: [1],
      subjectName: 'Subject 1',
      className: '10-A',
    });
  });

  it('leaves a semester the class-subject has no row in null, and the year is the other semester', () => {
    const [row] = subjectRows([classSubjectRow(1, 'sem2', quarters(88, 90))]);
    expect(row.semesters).toEqual({ sem1: null, sem2: 89 });
    expect(row.percentage).toBe(89);
  });

  it('rounds a K-12 grade to a whole number at each step', () => {
    const [row] = subjectRows([
      classSubjectRow(1, 'sem1', quarters(88, 89), { method: 'k12' }),
      classSubjectRow(1, 'sem2', quarters(80), { method: 'k12' }),
    ]);
    expect(row.semesters).toEqual({ sem1: 89, sem2: 80 }); // 88.5 rounds half up
    expect(row.percentage).toBe(85); // 84.5 rounds half up
  });

  it('puts a subject taken in two classes of the year into one row, as the general average counts it', () => {
    // 10-A in the 1st Quarter (70), then 10-B (2nd Quarter 90, 2nd Semester 80). Apart, 10-A read 70 Failed
    // and 10-B 85 Passed; together the 1st Semester is (70 + 90) / 2 = 80 and the year 80.
    const tagged = [
      classSubjectRow(1, 'sem1', quarters(70), { subjectId: 5, className: '10-A' }),
      classSubjectRow(2, 'sem1', quarters(null, 90), { subjectId: 5, className: '10-B' }),
      classSubjectRow(2, 'sem2', quarters(80), { subjectId: 5, className: '10-B' }),
    ];
    const rows = subjectRows(tagged);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: '5:2026-2027',
      subjectId: 5,
      classSubjectIds: [1, 2],
      className: '10-A / 10-B',
      semesters: { sem1: 80, sem2: 80 },
      percentage: 80,
    });
    expect(rows[0].rows).toEqual(tagged);
    expect(rows[0].percentage).toBe(generalAverage(tagged));
    expect(remarksOf(rows[0].percentage)).toBe('Passed');
  });

  it("puts the quarters of a semester's two classes together, a quarter graded in both averaged", () => {
    // The report card's case: Math (10-B) 73 Failed and Math (10-A) 87 Passed for one semester.
    const [row] = subjectRows([
      classSubjectRow(1, 'sem1', quarters(87, 90), { subjectId: 5, subjectName: 'Math', className: '10-A' }),
      classSubjectRow(2, 'sem1', quarters(null, 70, 76), {
        subjectId: 5,
        subjectName: 'Math',
        className: '10-B',
      }),
    ]);
    expect(row.quarters).toEqual(quarters(87, 80, 76));
    expect(row.semesters).toEqual({ sem1: 81, sem2: null });
    expect(row.percentage).toBe(81);
    expect(row.className).toBe('10-A / 10-B');
  });

  it('names a class once when the subject has a row in each semester there', () => {
    const [row] = subjectRows([
      classSubjectRow(1, 'sem1', quarters(80), { className: '10-A' }),
      classSubjectRow(1, 'sem2', quarters(90), { className: '10-A' }),
    ]);
    expect(row.className).toBe('10-A');
    expect(row.classSubjectIds).toEqual([1]);
  });

  it('keeps the same subject of two school years apart', () => {
    const rows = subjectRows([
      classSubjectRow(1, 'sem1', quarters(80), { subjectId: 5, academicYear: '2026-2027' }),
      classSubjectRow(2, 'sem1', quarters(70), { subjectId: 5, academicYear: '2025-2026' }),
    ]);
    expect(rows.map((row) => [row.key, row.percentage])).toEqual([
      ['5:2026-2027', 80],
      ['5:2025-2026', 70],
    ]);
  });

  it("is in the API's order, whichever semester a class-subject first appears in", () => {
    const rows = subjectRows([
      classSubjectRow(7, 'sem1', quarters(80), { subjectName: 'Math', className: '10-B' }),
      classSubjectRow(8, 'sem1', quarters(80), { subjectName: 'Science', className: '10-A' }),
      classSubjectRow(9, 'sem2', quarters(80), { subjectName: 'English', className: '10-A' }),
      classSubjectRow(3, 'sem2', quarters(80), {
        subjectName: 'Math',
        className: '9-A',
        academicYear: '2025-2026',
      }),
    ]);
    expect(rows.map((row) => `${row.academicYear} ${row.className} ${row.subjectName}`)).toEqual([
      '2026-2027 10-A English',
      '2026-2027 10-A Science',
      '2026-2027 10-B Math',
      '2025-2026 9-A Math',
    ]);
  });

  it('keeps the rows a subject was put together from, and drops what belongs to one semester', () => {
    const first = classSubjectRow(1, 'sem1', quarters(80));
    const second = classSubjectRow(1, 'sem2', quarters(90));
    const [row] = subjectRows([first, second]);
    expect(row.rows).toEqual([first, second]);
    expect(row).not.toHaveProperty('quarters');
    expect(row).not.toHaveProperty('semester');
    expect(row).not.toHaveProperty('assessmentsGraded');
  });

  it("gives the rows of one semester that semester's quarters and grade", () => {
    const [row] = subjectRows([classSubjectRow(1, 'sem2', quarters(88, 89), { method: 'k12' })]);
    expect(row.quarters).toEqual(quarters(88, 89));
    expect(row.percentage).toBe(89); // 88.5 rounds half up
  });

  it('is empty without rows', () => {
    expect(subjectRows([])).toEqual([]);
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

  it("averages each subject's semester grades first, then the subjects", () => {
    // Math: 1st Semester Q1 60, Q2 80, Q3 100 (80), 2nd Semester Q1 90: 85. English: 1st Semester 70,
    // 2nd Semester 80: 75. (85 + 75) / 2 = 80.
    const subjects = [
      subjectRow(1, '2026-2027', quarters(60, 80, 100)),
      subjectRow(1, '2026-2027', quarters(90), 'points', 'sem2'),
      subjectRow(2, '2026-2027', quarters(70)),
      subjectRow(2, '2026-2027', quarters(80), 'points', 'sem2'),
    ];
    expect(generalAverage(subjects)).toBe(80);
  });

  it('gives the general average of one semester from the rows of that semester alone', () => {
    const subjects = [
      subjectRow(1, '2026-2027', quarters(60, 80), 'points', 'sem2'),
      subjectRow(2, '2026-2027', quarters(90), 'points', 'sem2'),
    ];
    expect(generalAverage(subjects)).toBe(80); // (70 + 90) / 2
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

  it('names the Senior High groups as such, with their own weights', () => {
    expect(describeGrading({ gradingGroup: 'shs_core', gradeWeights: null })).toBe(
      'K-12 · Senior High – Core (25 · 50 · 25)',
    );
    expect(describeGrading({ gradingGroup: 'shs_academic', gradeWeights: null })).toBe(
      'K-12 · Senior High – Academic track (25 · 45 · 30)',
    );
    expect(describeGrading({ gradingGroup: 'shs_immersion', gradeWeights: null })).toBe(
      'K-12 · Senior High – Academic immersion, research (35 · 40 · 25)',
    );
    expect(describeGrading({ gradingGroup: 'shs_tvl', gradeWeights: null })).toBe(
      'K-12 · Senior High – TVL, Sports, Arts and Design (20 · 60 · 20)',
    );
    // Every group has a name, so none reads "undefined".
    expect(Object.keys(GRADING_GROUP_LABELS).sort()).toEqual([...GRADING_GROUPS].sort());
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
