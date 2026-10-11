import { ASSESSMENT_TYPES, COMPONENT_WEIGHTS, PASSING_GRADE, TERMS } from '../constants/shared';
import {
  ASSESSMENT_TYPE_LABELS,
  GRADE_DESCRIPTORS,
  GRADING_GROUP_LABELS,
  TERM_SHORT_LABELS,
} from '../constants/ui';
import { formatPercent, formatScore } from './format';

/**
 * Groups rows by the key `keyFn` returns, keeping the order in which keys first appear.
 * Used to split the flat `GET /grades` rows into one card per subject:
 *   groupBy(grades, (grade) => grade.assessment.classSubjectId)
 * Quarterly grades and each class-subject's final grade always come from `GET /grades/summary` (K-12
 * components, points or the subject's weights) and are never recomputed here; only what spans several
 * summary rows is derived from them: a subject's final grade over two classes of a year (subjectFinalGrade)
 * and the general average.
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
 * The points percentage of each assessment type in one subject's grades, { quiz: 85, exam: 92 }, the same
 * figure the API weights for a weighted subject. Types without grades are left out.
 * @param {Array<{ score: number, assessment: { type: string, maxScore: number } }>} grades
 */
export function percentageByType(grades) {
  const totals = {};
  for (const { score, assessment } of grades) {
    totals[assessment.type] ??= { score: 0, max: 0 };
    totals[assessment.type].score += Number(score);
    totals[assessment.type].max += Number(assessment.maxScore);
  }
  return Object.fromEntries(
    Object.entries(totals).map(([type, total]) => [type, round2((total.score / total.max) * 100)]),
  );
}

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
 * A final grade from quarterly grades, as the API computes it: their mean over the quarters that have one
 * (the average so far while a quarter is ungraded), a whole number for K-12 (rounded half up), otherwise
 * rounded to 2 decimals. Null when no quarter has a grade.
 * @param {Array<number|null|undefined>} quarterGrades
 * @param {string} [method] 'k12', 'points' or 'weighted'
 */
export function finalGradeOf(quarterGrades, method) {
  const values = quarterGrades.filter((value) => value !== null && value !== undefined);
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return method === 'k12' ? roundWhole(mean) : round2(mean);
}

/**
 * The quarterly grades of one subject in one school year from its summary rows (one per class; two when the
 * student changed class): the quarters of the classes put together, a quarter graded in both averaged
 * (finalGradeOf). { term1: 88, term2: 90, term3: null, term4: null }.
 * @param {Array<{ method: string, quarters: Record<string, number|null> }>} rows at least one
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
 * The final grade of one subject in one school year from its summary rows: the average of its quarterly
 * grades (subjectQuarters). With one class it is that row's `percentage`. The API's subjectFinalGrade.
 * @param {Array<{ method: string, quarters: Record<string, number|null> }>} rows at least one
 */
export const subjectFinalGrade = (rows) => finalGradeOf(Object.values(subjectQuarters(rows)), rows[0].method);

/**
 * The general average of summary rows (`GET /grades/summary?groupBy=classSubject`): the mean of the subjects'
 * final grades, each subject counting once per school year (subjectFinalGrade over its classes of that year).
 * The same rule as the API's `method: average`.
 * @param {Array<{ subjectId: number, academicYear: string, method: string,
 *   quarters: Record<string, number|null> }>} subjects
 */
export function generalAverage(subjects) {
  const bySubject = groupBy(subjects, (subject) => `${subject.subjectId}:${subject.academicYear}`);
  return averageOf([...bySubject.values()].map((rows) => subjectFinalGrade(rows)));
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
