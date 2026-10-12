const EMPTY = '—';

const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** A percentage is shown to 0.1%: a thousandth of the ratio. */
const PERCENT_STEPS = 1000;

/**
 * Ratio between 0 and 1 -> '92.5%'. `null` (nothing recorded yet) renders as an em dash.
 * The API's attendance `rate` is already a ratio; a grade `percentage` (0-100) must be divided by 100.
 *
 * Cut to the 0.1% shown, never rounded up: the API compares the exact value with its thresholds, so a rate of
 * 0.7996 listed as below 80% must read 79.9%, not 80%, and a score just under a pass mark must not read as on
 * it. (Intl's `roundingMode: 'trunc'` would do this, but Firefox before 116 ignores it.) The tiny nudge keeps a
 * value that sits on a step, such as 2.9 / 100, from landing just under it in binary floating point and
 * losing 0.1%. Ratios are never negative, so cutting down is cutting toward zero.
 */
export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return EMPTY;
  return percentFormatter.format(Math.floor(ratio * PERCENT_STEPS + 1e-9) / PERCENT_STEPS);
}

/** 1, 'student' -> '1 student'; 3, 'student' -> '3 students'. Pass `plural` when adding "s" is wrong. */
export function countOf(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** 18, 20 -> '18 / 20'; without a max just '18'; an ungraded (null) score renders as an em dash. */
export function formatScore(score, maxScore) {
  if (score === null || score === undefined) return EMPTY;
  const formatted = numberFormatter.format(score);
  return maxScore === undefined ? formatted : `${formatted} / ${numberFormatter.format(maxScore)}`;
}
