import { cx } from '../../utils/cx';

/**
 * Small yellow count beside a navigation entry: something there needs the user ("3 students
 * without a class"). Yellow means "act here", so only actionable counts get one; zero shows nothing.
 * The visible number is hidden from screen readers in favour of `label`.
 *
 * @param {object} props
 * @param {number} props.count
 * @param {string} props.label full sentence for screen readers, e.g. "3 students without a class"
 */
export function NavBadge({ count, label, className }) {
  if (!count) return null;
  return (
    <span
      className={cx(
        'tabular inline-flex min-w-5 items-center justify-center rounded-md bg-accent px-1.5 text-xs leading-5 font-semibold text-accent-ink',
        className,
      )}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">, {label}</span>
    </span>
  );
}
