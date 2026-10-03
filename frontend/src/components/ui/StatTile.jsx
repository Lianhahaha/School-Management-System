import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { TONE_DOT_CLASSES, TONE_SOFT_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * A figure as a pill row: icon chip, label, value on the right (tabular), and a chevron when the
 * row links somewhere. Rows stack inside a sheet, so a dashboard reads as a list of answers,
 * not a wall of number tiles.
 * @param {object} props
 * @param {string} props.label
 * @param {import('react').ReactNode} props.value
 * @param {string} [props.hint] small text under the label
 * @param {import('react').ElementType} [props.icon] lucide icon
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone] only when the figure carries a state
 *   (e.g. amber while students need a class): it tints the icon chip, or adds a dot when there is no icon
 * @param {string} [props.to] route to open on click
 */
export function StatTile({ label, value, hint, icon: Icon, tone, to }) {
  const classes =
    'flex min-h-14 items-center gap-3 rounded-[1.25rem] bg-gray-100 py-2 pr-3 pl-2 sm:rounded-full sm:pr-4';
  const content = (
    <>
      {Icon && (
        <span
          className={cx(
            'hidden size-10 shrink-0 items-center justify-center rounded-full sm:flex',
            tone ? TONE_SOFT_CLASSES[tone] : 'bg-surface text-gray-700',
          )}
        >
          <Icon className="size-[1.125rem]" aria-hidden="true" />
        </span>
      )}
      <span className={cx('min-w-0 flex-1 pl-2', Icon && 'sm:pl-0')}>
        <span className="flex items-center gap-2 text-sm leading-snug font-medium text-gray-900 sm:text-[0.9375rem]">
          {tone && !Icon && (
            <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_DOT_CLASSES[tone])} />
          )}
          {label}
        </span>
        {hint && <span className="hidden truncate text-xs text-gray-500 sm:block">{hint}</span>}
      </span>
      <span className="tabular text-lg font-semibold text-gray-900">{value}</span>
      {to && <ChevronRight className="-mr-1 hidden size-4 text-gray-500 sm:block" aria-hidden="true" />}
    </>
  );

  return to ? (
    <Link to={to} className={cx(classes, 'transition-colors hover:bg-gray-200')}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
