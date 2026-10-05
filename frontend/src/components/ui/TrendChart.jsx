import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../../utils/cx';

/** Width of the element in px, kept current while it resizes (0 before the first layout). */
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const clamp = (value) => Math.min(100, Math.max(0, value));

/**
 * The value range a sparkline spans: its values and the threshold with 5 points of room, within 0-100 and at
 * least 20 points tall, so a change from 62 to 81 reads as a climb and not as a flat line.
 */
function fittedRange(values) {
  const low = Math.max(0, Math.floor(Math.min(...values) - 5));
  const high = Math.min(100, Math.ceil(Math.max(...values) + 5));
  if (high - low >= 20) return [low, high];
  const middle = (low + high) / 2;
  const fittedLow = Math.max(0, Math.min(80, middle - 10));
  return [fittedLow, fittedLow + 20];
}

/**
 * A line of percentages over time, drawn as plain SVG at the container's width. A null value leaves a gap
 * in the line. Screen readers get the same data as a table instead of the drawing.
 *
 *   <TrendChart label="Weekly attendance rate" points={[{ label: 'Oct 5', value: 92.5 }, …]}
 *               threshold={80} formatValue={(v) => `${v}%`} />
 *
 * @param {object} props
 * @param {Array<{ label: string, value: number | null }>} props.points oldest first, values 0-100
 * @param {string} props.label what the chart shows; the caption of the table for screen readers
 * @param {(value: number) => string} props.formatValue
 * @param {number} [props.threshold] draws a dashed line at this value (a pass line, a target)
 * @param {boolean} [props.compact] a sparkline: no axes or labels, only the line and its last point, on a
 *   range fitted to its values (the full chart always spans 0-100 with labelled gridlines)
 * @param {number} [props.height] px (default 160, compact 40)
 */
export function TrendChart({ points, label, formatValue, threshold, compact = false, height, className }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const chartHeight = height ?? (compact ? 40 : 160);
  const pad = compact
    ? { top: 4, right: 4, bottom: 4, left: 4 }
    : { top: 10, right: 12, bottom: 24, left: 40 };
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = chartHeight - pad.top - pad.bottom;
  const x = (index) =>
    pad.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const values = points.filter((point) => point.value !== null).map((point) => clamp(point.value));
  const [low, high] =
    compact && values.length
      ? fittedRange(threshold === undefined ? values : [...values, threshold])
      : [0, 100];
  const y = (value) => pad.top + (1 - (clamp(value) - low) / (high - low)) * plotHeight;

  // One path; a null value lifts the pen, so gaps stay gaps.
  let path = '';
  let penDown = false;
  points.forEach((point, index) => {
    if (point.value === null) {
      penDown = false;
      return;
    }
    path += `${penDown ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`;
    penDown = true;
  });
  let lastIndex = points.length - 1;
  while (lastIndex >= 0 && points[lastIndex].value === null) lastIndex -= 1;
  // First and last label, plus the middle one once there is room between them.
  const last = points.length - 1;
  const labelIndexes = points.length >= 5 ? [0, Math.floor(last / 2), last] : [...new Set([0, last])];
  const anchorOf = (index) => {
    if (points.length === 1) return 'middle';
    if (index === 0) return 'start';
    return index === last ? 'end' : 'middle';
  };

  return (
    <figure className={cx('w-full', className)}>
      <div ref={ref} className="w-full">
        {width > 0 && (
          <svg width={width} height={chartHeight} aria-hidden="true" className="block overflow-visible">
            {!compact &&
              [0, 50, 100].map((tick) => (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    x2={pad.left + plotWidth}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="stroke-gray-200"
                    strokeWidth="1"
                  />
                  <text
                    x={pad.left - 8}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-[0.6875rem] tabular-nums"
                  >
                    {tick}%
                  </text>
                </g>
              ))}
            {threshold !== undefined && (
              <line
                x1={pad.left}
                x2={pad.left + plotWidth}
                y1={y(threshold)}
                y2={y(threshold)}
                className="stroke-amber-600"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}
            <path
              d={path}
              fill="none"
              className="stroke-gray-900"
              strokeWidth={compact ? 1.75 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) =>
              point.value === null || (compact && index !== lastIndex) ? null : (
                <circle
                  key={index}
                  cx={x(index)}
                  cy={y(point.value)}
                  r={compact ? 2.5 : 3.5}
                  className="fill-gray-900 stroke-surface"
                  strokeWidth="1.5"
                >
                  <title>{`${point.label}: ${formatValue(point.value)}`}</title>
                </circle>
              ),
            )}
            {!compact &&
              labelIndexes.map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y={chartHeight - 6}
                  textAnchor={anchorOf(index)}
                  className="fill-gray-500 text-[0.6875rem]"
                >
                  {points[index].label}
                </text>
              ))}
          </svg>
        )}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <th scope="row">{point.label}</th>
              <td>{point.value === null ? 'none' : formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
