import { cx } from '../../utils/cx';

/**
 * One percentage as a filled track (0-100) with a mark at the goal: grey at or above the goal, oxblood ink
 * below it. Decorative; the value is always written beside it.
 *
 * @param {object} props
 * @param {number | null} props.value 0-100; an empty track without one
 * @param {number} [props.goal] draws a mark at this value; the fill turns oxblood below it
 */
export function Meter({ value, goal, className }) {
  const below = goal !== undefined && value !== null && value < goal;
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <span
      className={cx('relative block h-2.5 w-full rounded-full bg-gray-200', className)}
      aria-hidden="true"
    >
      <span
        className={cx('absolute inset-y-0 left-0 rounded-full', below ? 'bg-attention-ink' : 'bg-gray-400')}
        style={{ width: `${width}%` }}
      />
      {goal !== undefined && (
        <span
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-gray-900"
          style={{ left: `${goal}%` }}
        />
      )}
    </span>
  );
}
