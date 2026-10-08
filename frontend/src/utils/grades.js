import { ASSESSMENT_TYPES } from '../constants/shared';
import { ASSESSMENT_TYPE_LABELS } from '../constants/ui';
import { formatPercent } from './format';

/**
 * Groups rows by the key `keyFn` returns, keeping the order in which keys first appear.
 * Used to split the flat `GET /grades` rows into one card per subject:
 *   groupBy(grades, (grade) => grade.assessment.classSubjectId)
 * Subject results always come from `GET /grades/summary` (points or the subject's weights) and are never
 * recomputed here; only the report card's general average is derived from them (see averageOf).
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
 * A result on the 0-100 scale of the API as text: 87.5 -> '87.5%', null (nothing that counts is graded
 * yet) -> an em dash.
 */
export const formatResult = (percentage) => formatPercent(percentage === null ? null : percentage / 100);

/** CSS width of a result bar: 0-100 %, an empty bar for null. */
export const resultWidth = (percentage) => `${Math.min(100, Math.max(0, percentage ?? 0))}%`;

/** Rounded to 2 decimals, half up, without floating-point dust (the API's round2). */
const round2 = (value) => Math.round(Number((value * 100).toPrecision(15))) / 100;

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
 * The general average of summary rows (`GET /grades/summary?groupBy=classSubject`): each subject counts once
 * per school year. A subject graded in two classes of a year (the student changed class) first averages
 * those class results. The same rule as the API's `method: average`.
 * @param {Array<{ subjectId: number, academicYear: string, percentage: number|null }>} subjects
 */
export function generalAverage(subjects) {
  const bySubject = groupBy(subjects, (subject) => `${subject.subjectId}:${subject.academicYear}`);
  return averageOf([...bySubject.values()].map((rows) => averageOf(rows.map((row) => row.percentage))));
}

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
