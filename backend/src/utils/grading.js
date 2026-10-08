/**
 * Grade arithmetic: the one place that turns scores into a percentage, a subject result and an average.
 *
 *   one grade        score / maxScore * 100
 *   subject result   on points (default): SUM(score) / SUM(maxScore) * 100 over the graded assessments;
 *                    weighted (the subject has weights per assessment type): each type's points percentage
 *                    times its weight, divided by the weights of the types that have grades, so a type with
 *                    nothing graded yet neither helps nor hurts. Types weighted 0 do not count.
 *   general average  the plain mean of subject results, each subject counting once: a subject taken in two
 *                    classes of one academic year (a student who changed class) first averages its
 *                    class results into one (see generalAverageOf).
 *
 * Percentages are 0-100 and rounded to 2 decimals.
 */

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
 * The result of one subject from its points per assessment type.
 *
 * @param {Array<{ type: string, totalScore: number, totalMaxScore: number }>} typeTotals graded points per type
 * @param {Record<string, number> | null} weights percent per type (adding up to 100), or null for points
 * @returns {{ percentage: number | null, method: 'points' | 'weighted' }}
 */
export function subjectResult(typeTotals, weights) {
  if (!weights) {
    const score = sumPoints(typeTotals.map((row) => row.totalScore));
    const max = sumPoints(typeTotals.map((row) => row.totalMaxScore));
    return { percentage: percentOf(score, max), method: 'points' };
  }
  let weighted = 0;
  let weightUsed = 0;
  for (const row of typeTotals) {
    const weight = weights[row.type] ?? 0;
    if (weight === 0 || !row.totalMaxScore) continue;
    weighted += (row.totalScore / row.totalMaxScore) * 100 * weight;
    weightUsed += weight;
  }
  return { percentage: weightUsed ? round2(weighted / weightUsed) : null, method: 'weighted' };
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
