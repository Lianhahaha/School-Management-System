import { ASSESSMENT_TYPES, COMPONENT_WEIGHTS, PASSING_GRADE, SEMESTERS, TERMS } from '../constants/shared';
import {
  ASSESSMENT_TYPE_LABELS,
  GRADE_DESCRIPTORS,
  GRADING_GROUP_LABELS,
  SEMESTER_LABELS,
  SEMESTER_SHORT_LABELS,
  TERM_SHORT_LABELS,
} from '../constants/ui';
import { formatPercent, formatScore } from './format';

/**
 * Groups rows by the key `keyFn` returns, keeping the order in which keys first appear.
 * Used to split the flat `GET /grades` rows into one card per subject:
 *   groupBy(grades, (grade) => grade.assessment.classSubjectId)
 * Quarterly grades and each class-subject's grade of a semester or of the year always come from
 * `GET /grades/summary` (K-12 components, points or the subject's weights) and are never recomputed here;
 * only what spans several summary rows is derived from them: a subject's grade over two classes of a year
 * (subjectSemesters, subjectFinalGrade, subjectRows) and the general average.
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => *} keyFn
 * @returns {Map<*, T[]>}
 */
export function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

/**
 * A subject result or average as a report card writes it: 90 -> '90', 88.833 -> '88.83', null (nothing that
 * counts is graded yet) -> an em dash. A K-12 result is a grade from 60 to 100, not a percentage.
 */
export const formatResult = (result) => formatScore(result);

/** An assessment's percentage (score / max): 87.5 -> '87.5%'. */
export const formatPercentage = (percentage) =>
  formatPercent(percentage === null || percentage === undefined ? null : percentage / 100);

/**
 * The DepEd descriptor of a result, `{ label, tone }` (a Badge tone), or null without a result:
 * 90-100 Outstanding, 85-89 Very Satisfactory, 80-84 Satisfactory, 75-79 Fairly Satisfactory, below 75 Did
 * Not Meet Expectations.
 * @param {number | null} result
 */
export function descriptorOf(result) {
  if (result === null || result === undefined) return null;
  return GRADE_DESCRIPTORS.find((band) => result >= band.min);
}

/**
 * The score percentage that passes in a subject graded this way: 60 for K-12 (an initial grade of 60
 * transmutes to 75), otherwise the passing grade itself, 75.
 * @param {'k12'|'points'|'weighted'} method
 */
export const passMarkOf = (method) => (method === 'k12' ? 60 : PASSING_GRADE);

/** True when a result reaches the passing grade (75). */
export const isPassing = (result) => result !== null && result !== undefined && result >= PASSING_GRADE;

/**
 * The remarks of a grade, as a report card writes them: Passed from the passing grade (75) up, else Failed;
 * an empty string without a grade.
 * @param {number | null | undefined} result
 * @returns {'Passed' | 'Failed' | ''}
 */
export const remarksOf = (result) =>
  result === null || result === undefined ? '' : isPassing(result) ? 'Passed' : 'Failed';

/**
 * How a subject is graded, in words: 'K-12 · Math and Science (40 · 40 · 20)', 'Quiz 20% · Exam 80%' or
 * 'On points'. Takes a subject or a summary row (both carry `gradingGroup` and `gradeWeights`).
 */
export function describeGrading({ gradingGroup, gradeWeights }) {
  if (gradingGroup) {
    const weights = COMPONENT_WEIGHTS[gradingGroup];
    return `K-12 · ${GRADING_GROUP_LABELS[gradingGroup]} (${weights.written} · ${weights.performance} · ${weights.quarterly})`;
  }
  return describeWeights(gradeWeights) || 'On points';
}

/** CSS width of a result bar: 0-100 %, an empty bar for null. */
export const resultWidth = (percentage) => `${Math.min(100, Math.max(0, percentage ?? 0))}%`;

/** Rounded to 2 decimals, half up, without floating-point dust (the API's round2). */
const round2 = (value) => Math.round(Number((value * 100).toPrecision(15))) / 100;

/** Rounded to a whole number, half up, without floating-point dust (the API's roundWhole). */
const roundWhole = (value) => Math.round(Number(value.toPrecision(15)));

/**
 * The mean of results, ignoring those without one. Rounded to 2 decimals; null when empty.
 * @param {Array<number|null>} percentages
 */
export function averageOf(percentages) {
  const values = percentages.filter((value) => value !== null && value !== undefined);
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * A grade from the grades one level below, as the API computes it: the quarterly grades of a semester, or
 * the semester grades of a school year. Their mean over those that have one (the average so far while a
 * quarter is ungraded), a whole number for K-12 (rounded half up), otherwise rounded to 2 decimals. Null when
 * none has a grade.
 * @param {Array<number|null|undefined>} grades
 * @param {string} [method] 'k12', 'points' or 'weighted'
 */
export function finalGradeOf(grades, method) {
  const values = grades.filter((value) => value !== null && value !== undefined);
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return method === 'k12' ? roundWhole(mean) : round2(mean);
}

/**
 * The quarterly grades of one subject in one semester of a school year from its summary rows of that
 * semester (`GET /grades/summary?semester=`, one per class; two when the student changed class): the quarters
 * of the classes put together, a quarter graded in both averaged (finalGradeOf).
 * { term1: 88, term2: 90, term3: null, term4: null }. The API's subjectQuarters, which reads the semester out
 * of the results it holds instead.
 * @param {Array<{ method: string, quarters: Record<string, number|null> }>} rows of one semester, at least one
 * @returns {Record<string, number|null>}
 */
export function subjectQuarters(rows) {
  const { method } = rows[0];
  return Object.fromEntries(
    TERMS.map((term) => [
      term,
      finalGradeOf(
        rows.map((row) => row.quarters[term]),
        method,
      ),
    ]),
  );
}

/**
 * The grade of each semester of one subject in one school year from its summary rows: the rows of each
 * semester (`semester` tags the request the row came from: rows fetched with `?semester=sem1` are tagged
 * 'sem1') have their quarters put together per class (subjectQuarters) and averaged, null for a semester
 * with no row or no graded quarter. { sem1: 88, sem2: null }. The API's subjectSemesters.
 * @param {Array<{ method: string, semester: string, quarters: Record<string, number|null> }>} rows
 *   at least one, of any semesters
 * @returns {Record<string, number|null>}
 */
export function subjectSemesters(rows) {
  const { method } = rows[0];
  return Object.fromEntries(
    SEMESTERS.map((semester) => {
      const ofSemester = rows.filter((row) => row.semester === semester);
      return [
        semester,
        ofSemester.length ? finalGradeOf(Object.values(subjectQuarters(ofSemester)), method) : null,
      ];
    }),
  );
}

/**
 * The grade of one subject in one school year from its summary rows (tagged with their semester, as in
 * subjectSemesters): the average of its semester grades that exist. A semester with no graded quarter is left
 * out, so one semester graded gives that semester's grade, and two semesters with different numbers of graded
 * quarters weigh the semesters equally, not the quarters. The API's subjectFinalGrade.
 * @param {Array<{ method: string, semester: string, quarters: Record<string, number|null> }>} rows at least one
 */
export const subjectFinalGrade = (rows) =>
  finalGradeOf(Object.values(subjectSemesters(rows)), rows[0].method);

/**
 * The general average of summary rows (`GET /grades/summary?groupBy=classSubject&semester=`, the rows of each
 * semester tagged with it): the mean of the subjects' grades, each subject counting once per school year
 * (subjectFinalGrade over its classes of that year). Rows of one semester alone give that semester's general
 * average. The same rule as the API's `method: average`.
 * @param {Array<{ subjectId: number, academicYear: string, method: string, semester: string,
 *   quarters: Record<string, number|null> }>} subjects
 */
export function generalAverage(subjects) {
  const bySubject = groupBy(subjects, (subject) => `${subject.subjectId}:${subject.academicYear}`);
  return averageOf([...bySubject.values()].map((rows) => subjectFinalGrade(rows)));
}

/**
 * Summary rows of one semester, each tagged with the `semester` it was fetched for: the tag subjectSemesters,
 * subjectFinalGrade and generalAverage read (the API's rows do not carry it).
 * @param {Array<Record<string, any>>} rows
 * @param {string} semester
 * @returns {Array<Record<string, any> & { semester: string }>}
 */
export const tagSemester = (rows, semester) => rows.map((row) => ({ ...row, semester }));

/**
 * One row per subject and school year from summary rows tagged with their semester (the rows of
 * `GET /grades/summary?groupBy=classSubject&semester=`, one request per semester, see tagSemester), as a
 * student's grades are shown: My grades, the report card and the grade cards. A subject taken in two classes of
 * one year (the student changed class) is one row, its quarters put together per semester and quarter as the
 * general average and the SF10 do (subjectQuarters, subjectSemesters, subjectFinalGrade), so it never reads
 * Failed in one class and Passed in the other while the general average counts it once. Each row has
 *   key              'subjectId:academicYear', unique among the rows
 *   classSubjectIds  the class-subjects it was put together from, in the order of the rows
 *   className        their classes, 'Grade 10 - A / Grade 10 - B'
 *   semesters        each semester's grade, { sem1: 88, sem2: null }: null for a semester with no row or no
 *                    graded quarter
 *   quarters         the quarterly grades, only when every row is of one semester (the rows of a semester)
 *   percentage       the grade of the rows' period: the semester's, or the school year's
 *   rows             the summary rows it was put together from, for what needs them (the points, the count)
 * and the subject's id, name, school year and grading (method, gradingGroup, gradeWeights). With one class
 * every figure is the API's own. In the API's order: school year newest first, then class, then subject.
 * @template {{ classSubjectId: number, subjectId: number, subjectName: string, className: string,
 *   academicYear: string, method: string, gradingGroup?: string | null, gradeWeights?: object | null,
 *   semester: string, quarters: Record<string, number|null> }} T
 * @param {T[]} rows tagged with their semester
 */
export function subjectRows(rows) {
  return [...groupBy(rows, (row) => `${row.subjectId}:${row.academicYear}`).entries()]
    .map(([key, group]) => {
      const { subjectId, subjectName, academicYear, method } = group[0];
      const { gradingGroup = null, gradeWeights = null } = group[0];
      const oneSemester = new Set(group.map((row) => row.semester)).size === 1;
      return {
        key,
        subjectId,
        subjectName,
        academicYear,
        method,
        gradingGroup,
        gradeWeights,
        classSubjectIds: [...new Set(group.map((row) => row.classSubjectId))],
        className: [...new Set(group.map((row) => row.className))].join(' / '),
        semesters: subjectSemesters(group),
        ...(oneSemester && { quarters: subjectQuarters(group) }),
        percentage: subjectFinalGrade(group),
        rows: group,
      };
    })
    .sort(
      (a, b) =>
        b.academicYear.localeCompare(a.academicYear) ||
        a.className.localeCompare(b.className) ||
        a.subjectName.localeCompare(b.subjectName) ||
        a.subjectId - b.subjectId,
    );
}

/**
 * The quarters of a summary row that have a grade, in order: ['term1', 'term2'].
 * @param {{ quarters?: Record<string, number|null> }} row
 */
export const gradedQuarters = (row) =>
  TERMS.filter((term) => row.quarters?.[term] !== null && row.quarters?.[term] !== undefined);

/**
 * The graded quarters of a summary row with their grades, for a line of text: 'Q1 88, Q2 90'.
 * @param {{ quarters?: Record<string, number|null> }} row
 */
export const describeQuarters = (row) =>
  gradedQuarters(row)
    .map((term) => `${TERM_SHORT_LABELS[term]} ${formatResult(row.quarters[term])}`)
    .join(', ');

/**
 * The semesters of a summary row without the `semester` filter that have a grade, in order: ['sem1'].
 * @param {{ semesters?: Record<string, number|null> }} row
 */
export const gradedSemesters = (row) =>
  SEMESTERS.filter(
    (semester) => row.semesters?.[semester] !== null && row.semesters?.[semester] !== undefined,
  );

/**
 * The graded semesters of such a row with their grades, for a line of text: '1st Semester 88, 2nd Semester 90'.
 * @param {{ semesters?: Record<string, number|null> }} row
 */
export const describeSemesters = (row) =>
  gradedSemesters(row)
    .map((semester) => `${SEMESTER_LABELS[semester]} ${formatResult(row.semesters[semester])}`)
    .join(', ');

/**
 * A grading period in a table cell: the semester and the quarter within it, '1st Sem · Q1'.
 * @param {string} semester 'sem1' or 'sem2'
 * @param {string} term 'term1' to 'term4'
 */
export const formatPeriod = (semester, term) =>
  `${SEMESTER_SHORT_LABELS[semester]} · ${TERM_SHORT_LABELS[term]}`;

/**
 * A subject's grade weights as text, in assessment-type order and without the types weighted 0:
 * { quiz: 20, exam: 80, ... } -> 'Quiz 20% · Exam 80%'. Empty string for null (graded on points).
 * @param {Record<string, number> | null} gradeWeights
 */
export function describeWeights(gradeWeights) {
  if (!gradeWeights) return '';
  return ASSESSMENT_TYPES.filter((type) => gradeWeights[type] > 0)
    .map((type) => `${ASSESSMENT_TYPE_LABELS[type]} ${gradeWeights[type]}%`)
    .join(' · ');
}
