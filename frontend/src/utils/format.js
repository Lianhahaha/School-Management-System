const EMPTY = '—';

const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/**
 * Ratio between 0 and 1 -> '92.5%'. `null` (nothing recorded yet) renders as an em dash.
 * The API's attendance `rate` is already a ratio; a grade `percentage` (0-100) must be divided by 100.
 */
export function formatPercent(ratio) {
  return ratio === null || ratio === undefined ? EMPTY : percentFormatter.format(ratio);
}

/** 18, 20 -> '18 / 20'; without a max just '18'; an ungraded (null) score renders as an em dash. */
export function formatScore(score, maxScore) {
  if (score === null || score === undefined) return EMPTY;
  const formatted = numberFormatter.format(score);
  return maxScore === undefined ? formatted : `${formatted} / ${numberFormatter.format(maxScore)}`;
}
