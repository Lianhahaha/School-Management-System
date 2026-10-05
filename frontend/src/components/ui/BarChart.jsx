import { cx } from '../../utils/cx';

/**
 * Vertical bars with their count on top and a label underneath, for a small distribution such as the spread
 * of scores on one assessment. Bars scale to the largest value; an empty bar is a hairline, so the scale
 * stays readable. Screen readers get the same data as a table instead of the drawing.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: number, longLabel?: string }>} props.bars in display order; `longLabel`
 *   names the bar in the screen-reader table when the short label needs context ("70" -> "70 to 79%")
 * @param {string} props.label what the chart shows; the caption of the table for screen readers
 * @param {number} [props.height] px of the tallest bar (default 112)
 */
export function BarChart({ bars, label, height = 112, className }) {
  const largest = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <figure className={cx('w-full', className)}>
      <div aria-hidden="true">
        <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: height + 20 }}>
          {bars.map((bar) => (
            <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span className="mb-1 text-center text-xs text-gray-600 tabular-nums">
                {bar.value > 0 ? bar.value : ''}
              </span>
              <div
                className={cx('rounded-t-md', bar.value > 0 ? 'bg-gray-900' : 'bg-gray-200')}
                style={{ height: bar.value > 0 ? `${(bar.value / largest) * height}px` : '2px' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1 border-t border-gray-200 pt-1.5 sm:gap-1.5">
          {bars.map((bar) => (
            <span
              key={bar.label}
              className="min-w-0 flex-1 truncate text-center text-[0.6875rem] text-gray-500 tabular-nums"
            >
              {bar.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label}>
              <th scope="row">{bar.longLabel ?? bar.label}</th>
              <td>{bar.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
