import { describe, expect, it } from 'vitest';
import { formatPercent } from '../src/utils/format';

describe('formatPercent', () => {
  // The API flags a rate below 0.8 against the exact value; rounded, 0.7996 read "80%" under "Below 80%".
  it('cuts to the 0.1% shown instead of rounding up to the next step', () => {
    expect(formatPercent(0.7996)).toBe('79.9%');
    expect(formatPercent(0.9999)).toBe('99.9%');
    expect(formatPercent(2 / 3)).toBe('66.6%');
  });

  it('shows a value on a step as it is', () => {
    expect(formatPercent(0.8)).toBe('80%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.925)).toBe('92.5%');
  });

  // 2.9 / 100 * 1000 is 28.999999999999996 in floating point (75.1 and 92.3 fall short too): cut bare,
  // 2.9 would read 2.8%.
  it('does not lose 0.1% to floating point on a grade percentage divided by 100', () => {
    expect(formatPercent(2.9 / 100)).toBe('2.9%');
    expect(formatPercent(75.1 / 100)).toBe('75.1%');
    expect(formatPercent(92.3 / 100)).toBe('92.3%');
  });

  it('renders nothing recorded as an em dash', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });
});
