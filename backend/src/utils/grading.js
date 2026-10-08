/**
 * Grade arithmetic: the one place that turns scores into a percentage, a subject result and an average.
 *
 *   one grade        score / maxScore * 100
 *   subject result   K-12 (the subject has a grading group, DepEd Order 8 s. 2015): each component's points
 *                    percentage (written work, performance tasks, quarterly assessment) times the group's
 *                    weight gives the initial grade, transmuted to the 60-100 scale (75 passes); components
 *                    with nothing graded yet are left out and the other weights scaled up;
 *                    on points (default): SUM(score) / SUM(maxScore) * 100 over the graded assessments;
 *                    weighted (the subject has weights per assessment type): each type's points percentage
 *                    times its weight, divided by the weights of the types that have grades, so a type with
 *                    nothing graded yet neither helps nor hurts. Types weighted 0 do not count.
 *   general average  the plain mean of subject results, each subject counting once: a subject taken in two
 *                    classes of one academic year (a student who changed class) first averages its
 *                    class results into one (see generalAverageOf).
 *
 * Percentages are 0-100 and rounded to 2 decimals; a K-12 grade is a whole number from 60 to 100.
 */
import { COMPONENT_OF_TYPE, COMPONENT_WEIGHTS, GRADING_COMPONENTS } from '../constants/shared.js';

/**
 * Rounded to 2 decimals, half up. toPrecision(15) first drops binary dust: 1.005 * 100 is 100.49999999999999
 * in floating point, which would otherwise round down to 1.00.
 */
const round2 = (value) => Math.round(Number((value * 100).toPrecision(15))) / 100;

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
 * K-12 result of one subject: its component percentages, the initial grade (the weighted components, over
 * the components that have grades) and that grade transmuted.
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

/**
 * The result of one subject from its points per assessment type. `percentage` is the result a report card
 * shows (for K-12 the transmuted grade); `initialGrade` is the value before transmutation (the same number
 * for the other methods); `components` is only set for K-12.
 *
 * @param {Array<{ type: string, totalScore: number, totalMaxScore: number, assessmentsGraded?: number }>} typeTotals
 *   graded points per type
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

/** Mean of the given percentages, ignoring nulls; null when there is none. */
export function averageOf(percentages) {
  const values = percentages.filter((value) => value !== null && value !== undefined);
  return values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/**
 * The general average of class-subject results, each subject counting once per academic year: the results
 * of one subject in several classes of a year are averaged first, then the subjects. Mirrored by the
 * frontend's utils/grades generalAverage.
 * @param {Array<{ subjectId: number, academicYear: string, percentage: number | null }>} results
 */
export function generalAverageOf(results) {
  const bySubject = new Map();
  for (const result of results) {
    const key = `${result.subjectId}:${result.academicYear}`;
    bySubject.set(key, [...(bySubject.get(key) ?? []), result.percentage]);
  }
  return averageOf([...bySubject.values()].map(averageOf));
}
