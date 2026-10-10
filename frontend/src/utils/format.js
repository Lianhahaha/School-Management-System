import { LOCALE } from './date';

const EMPTY = '—';

const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const pesoFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PHP' });

/**
 * Ratio between 0 and 1 -> '92.5%'. `null` (nothing recorded yet) renders as an em dash.
 * The API's attendance `rate` is already a ratio; a grade `percentage` (0-100) must be divided by 100.
 */
export function formatPercent(ratio) {
  return ratio === null || ratio === undefined ? EMPTY : percentFormatter.format(ratio);
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

/** Pesos with centavos, the same on every screen: 18000 -> '₱18,000.00'. */
export function formatPeso(amount) {
  return pesoFormatter.format(amount);
}
