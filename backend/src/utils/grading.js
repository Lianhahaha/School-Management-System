/**
 * Grade arithmetic: the one place that turns scores into a percentage, a subject result and an average.
 *
 *   one grade        score / maxScore * 100
 *   quarterly grade  a subject's result over the graded assessments of one quarter (subjectResult):
 *                    K-12 (the subject has a grading group, DepEd Order 8 s. 2015): each component's points
 *                    percentage (written work, performance tasks, quarterly assessment) times the group's
 *                    weight gives the quarter's initial grade, transmuted to the 60-100 scale (75 passes);
 *                    components with nothing graded yet in the quarter are left out and the other weights
 *                    scaled up;
 *                    on points (default): SUM(score) / SUM(maxScore) * 100 over the quarter's graded assessments;
 *                    weighted (the subject has weights per assessment type): each type's points percentage
 *                    times its weight, divided by the weights of the types that have grades, so a type with
 *                    nothing graded yet neither helps nor hurts. Types weighted 0 do not count.
 *   final grade      the average of the quarterly grades (finalResult, finalGradeOf), as DepEd Order 8 s. 2015
 *                    computes a learning area's final grade, over the quarters that have a grade: until all four
 *                    are graded it is the average so far. A K-12 final grade is a whole number (rounded half up);
 *                    on points or weighted it keeps 2 decimals. Every method follows this rule, so a report
 *                    card's final grade is always the mean of the quarterly grades printed beside it, and a
 *                    quarter with many assessments does not outweigh a quarter with few.
 *   general average  the plain mean of the subjects' final grades, each subject counting once per academic
 *                    year: a subject taken in two classes of one year (a student who changed class) first puts
 *                    the quarters of both classes together (subjectFinalGrade).
 *
 * Percentages are 0-100 and rounded to 2 decimals; a K-12 grade is a whole number from 60 to 100.
 */
import { COMPONENT_OF_TYPE, COMPONENT_WEIGHTS, GRADING_COMPONENTS, TERMS } from '../constants/shared.js';

/**
 * Rounded to 2 decimals, half up. toPrecision(15) first drops binary dust: 1.005 * 100 is 100.49999999999999
 * in floating point, which would otherwise round down to 1.00.
 */
const round2 = (value) => Math.round(Number((value * 100).toPrecision(15))) / 100;

/** Rounded to a whole number, half up, without floating-point dust (a K-12 final grade). */
const roundWhole = (value) => Math.round(Number(value.toPrecision(15)));

/** Sum of point values (scores have at most 2 decimals), without floating-point dust. */
export const sumPoints = (values) => round2(values.reduce((sum, value) => sum + value, 0));

/** score / maxScore as a percentage rounded to 2 decimals, or null when maxScore is 0. */
export const percentOf = (score, maxScore) => (maxScore ? round2((score / maxScore) * 100) : null);

/**
 * DepEd transmutation of an initial grade (0-100) to the 60-100 scale: 60 and above become 75 plus one step
 * per 1.6 points over 60 (100 stays 100), below 60 become 60 plus one step per 4 points. Worked in hundredths
 * so a boundary such as 84.00 never slips a step through floating-point error.
 * @param {number | null} initial
 * @returns {number | null}
 */
export function transmute(initial) {
  if (initial === null || initial === undefined) return null;
  const hundredths = Math.round(initial * 100);
  return hundredths >= 6000
    ? Math.min(100, 75 + Math.floor((hundredths - 6000) / 160))
    : 60 + Math.floor(hundredths / 400);
}

/**
 * K-12 result of one subject over the given assessments: its component percentages, the initial grade (the
 * weighted components, over the components that have grades) and that grade transmuted.
 */
function componentResult(typeTotals, group) {
  const weights = COMPONENT_WEIGHTS[group];
  const totals = new Map();
  for (const row of typeTotals) {
    const component = COMPONENT_OF_TYPE[row.type];
    const sum = totals.get(component) ?? { score: [], max: [], graded: 0 };
    sum.score.push(row.totalScore);
    sum.max.push(row.totalMaxScore);
    sum.graded += row.assessmentsGraded ?? 0;
    totals.set(component, sum);
  }
  const components = GRADING_COMPONENTS.map((component) => {
    const sum = totals.get(component);
    return {
      component,
      weight: weights[component],
      percentage: sum ? percentOf(sumPoints(sum.score), sumPoints(sum.max)) : null,
      assessmentsGraded: sum?.graded ?? 0,
    };
  });
  const counted = components.filter((part) => part.percentage !== null);
  const weightUsed = counted.reduce((total, part) => total + part.weight, 0);
  const initialGrade = weightUsed
    ? round2(counted.reduce((total, part) => total + part.percentage * part.weight, 0) / weightUsed)
    : null;
  return { percentage: transmute(initialGrade), initialGrade, method: 'k12', components };
}

/** How a subject is graded: by its K-12 group, by its weights per assessment type, or on points. */
const methodOf = (weights, group) => (group ? 'k12' : weights ? 'weighted' : 'points');

/**
 * The result of one subject over one set of assessments graded together, which is a quarter: the quarterly
 * grade (finalResult averages the quarters). `percentage` is the grade a report card shows (for K-12 the
 * transmuted grade); `initialGrade` is the value before transmutation (the same number for the other
 * methods); `components` is only set for K-12.
 *
 * @param {Array<{ type: string, totalScore: number, totalMaxScore: number, assessmentsGraded?: number }>} typeTotals
 *   graded points per type, one row per type
 * @param {Record<string, number> | null} weights percent per type (adding up to 100), or null for points
 * @param {string | null} [group] K-12 grading group (constants/shared GRADING_GROUPS); wins over `weights`
 * @returns {{ percentage: number | null, initialGrade: number | null, method: 'k12' | 'points' | 'weighted',
 *   components: Array<{ component: string, weight: number, percentage: number | null, assessmentsGraded: number }> | null }}
 */
export function subjectResult(typeTotals, weights, group = null) {
  if (group) return componentResult(typeTotals, group);
  if (!weights) {
    const score = sumPoints(typeTotals.map((row) => row.totalScore));
    const max = sumPoints(typeTotals.map((row) => row.totalMaxScore));
    const percentage = percentOf(score, max);
    return { percentage, initialGrade: percentage, method: 'points', components: null };
  }
  let weighted = 0;
  let weightUsed = 0;
  for (const row of typeTotals) {
    const weight = weights[row.type] ?? 0;
    if (weight === 0 || !row.totalMaxScore) continue;
    weighted += (row.totalScore / row.totalMaxScore) * 100 * weight;
    weightUsed += weight;
  }
  const percentage = weightUsed ? round2(weighted / weightUsed) : null;
  return { percentage, initialGrade: percentage, method: 'weighted', components: null };
}

/**
 * A final grade from quarterly grades: their mean over the quarters that have one, so while a quarter is
 * still ungraded it is the average so far. A whole number for K-12 (rounded half up, as DepEd reports final
 * grades), otherwise rounded to 2 decimals. Null when no quarter has a grade.
 * @param {Array<number | null | undefined>} quarterGrades
 * @param {string} [method] 'k12', 'points' or 'weighted'
 * @returns {number | null}
 */
export function finalGradeOf(quarterGrades, method) {
  const values = quarterGrades.filter((value) => value !== null && value !== undefined);
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return method === 'k12' ? roundWhole(mean) : round2(mean);
}

/**
 * The result of one subject (one class-subject) over a period, quarter by quarter (DepEd Order 8 s. 2015):
 * each quarter's assessments are graded on their own (subjectResult, its K-12 components and transmutation
 * within that quarter), and the final grade is the average of those quarterly grades (finalGradeOf). With a
 * term filter the period is one quarter, and the final grade is that quarter's grade.
 *
 * `quarters` holds each quarter's grade (null while it has none); `percentage` is the final grade.
 * `initialGrade` is, for K-12, the initial grade of the one quarter graded (the figure transmuted to
 * `percentage`), and null once several quarters are averaged (each was transmuted on its own); for the other
 * methods it is the final grade again. `components` (K-12) are the component percentages over every graded
 * assessment of the period: what the student scored in each, and the working of `initialGrade` while one
 * quarter is graded.
 *
 * @param {Array<{ term: string, type: string, totalScore: number, totalMaxScore: number, assessmentsGraded?: number }>} typeTotals
 *   graded points per quarter (`term`, constants/shared TERMS) and assessment type
 * @param {Record<string, number> | null} weights percent per type, or null
 * @param {string | null} [group] K-12 grading group; wins over `weights`
 * @returns {{ percentage: number | null, initialGrade: number | null, method: 'k12' | 'points' | 'weighted',
 *   components: Array<object> | null, quarters: Record<string, number | null> }}
 */
export function finalResult(typeTotals, weights, group = null) {
  const method = methodOf(weights, group);
  const byQuarter = TERMS.map((term) => {
    const rows = typeTotals.filter((row) => row.term === term);
    return rows.length ? subjectResult(rows, weights, group) : null;
  });
  const quarters = Object.fromEntries(
    TERMS.map((term, index) => [term, byQuarter[index]?.percentage ?? null]),
  );
  const graded = byQuarter.filter((result) => result !== null && result.percentage !== null);
  const percentage = finalGradeOf(Object.values(quarters), method);
  return {
    percentage,
    initialGrade: method !== 'k12' ? percentage : graded.length === 1 ? graded[0].initialGrade : null,
    method,
    components: group ? componentResult(typeTotals, group).components : null,
    quarters,
  };
}

/** Mean of the given percentages, ignoring nulls; null when there is none. */
export function averageOf(percentages) {
  const values = percentages.filter((value) => value !== null && value !== undefined);
  return values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/**
 * The quarterly grades of one subject in one academic year from its class-subject results (finalResult rows
 * of that subject and year; a student who changed class has one per class): the quarters of the classes put
 * together, a quarter graded in more than one class averaged the same way (finalGradeOf). Mirrored by the
 * frontend's utils/grades subjectQuarters.
 * @param {Array<{ method: string, quarters: Record<string, number | null> }>} results at least one
 * @returns {Record<string, number | null>}
 */
export function subjectQuarters(results) {
  const { method } = results[0];
  return Object.fromEntries(
    TERMS.map((term) => [
      term,
      finalGradeOf(
        results.map((result) => result.quarters[term]),
        method,
      ),
    ]),
  );
}

/**
 * The final grade of one subject in one academic year: the average of its quarterly grades over its classes
 * of that year (subjectQuarters). The 1st Quarter in one class and the 2nd to 4th in the other give
 * (Q1 + Q2 + Q3 + Q4) / 4, not the mean of the two class results; with one class it is that class's final
 * grade. Mirrored by the frontend's utils/grades subjectFinalGrade.
 * @param {Array<{ method: string, quarters: Record<string, number | null> }>} results at least one
 * @returns {number | null}
 */
export const subjectFinalGrade = (results) =>
  finalGradeOf(Object.values(subjectQuarters(results)), results[0].method);

/**
 * The general average of class-subject results, each subject counting once per academic year: its final
 * grade (subjectFinalGrade over its classes of that year), then the mean of the subjects. Mirrored by the
 * frontend's utils/grades generalAverage.
 * @param {Array<{ subjectId: number, academicYear: string, method: string,
 *   quarters: Record<string, number | null> }>} results
 */
export function generalAverageOf(results) {
  return averageOf(subjectYearResults(results).map((result) => result.percentage));
}

/**
 * One final grade per subject and academic year (subjectFinalGrade over the subject's classes of that year).
 * The general average and the promotion check both use it.
 * @param {Array<{ subjectId: number, subjectName?: string, academicYear: string, method: string,
 *   quarters: Record<string, number | null> }>} results
 * @returns {Array<{ subjectId: number, subjectName?: string, academicYear: string, percentage: number | null }>}
 */
export function subjectYearResults(results) {
  const bySubject = new Map();
  for (const result of results) {
    const key = `${result.subjectId}:${result.academicYear}`;
    bySubject.set(key, [...(bySubject.get(key) ?? []), result]);
  }
  return [...bySubject.values()].map((rows) => {
    const { subjectId, subjectName, academicYear } = rows[0];
    return { subjectId, subjectName, academicYear, percentage: subjectFinalGrade(rows) };
  });
}
