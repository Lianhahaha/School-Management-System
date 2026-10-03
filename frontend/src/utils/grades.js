/**
 * Groups rows by the key `keyFn` returns, keeping the order in which keys first appear.
 * Used to split the flat `GET /grades` rows into one card per subject:
 *   groupBy(grades, (grade) => grade.assessment.classSubjectId)
 * Aggregates (percentages, totals) always come from `GET /grades/summary` and are never recomputed here.
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
