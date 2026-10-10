import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { MARK_CLASSES, TONE_SOFT_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * A figure as a row: icon chip, label, value on the right (tabular), and a chevron when the
 * row links somewhere. Rows stack inside a sheet, so a dashboard reads as a list of answers,
 * not a wall of number tiles.
 * @param {object} props
 * @param {string} props.label
 * @param {import('react').ReactNode} props.value
 * @param {string} [props.hint] small text under the label
 * @param {import('react').ElementType} [props.icon] lucide icon
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone] only when the figure carries a state
 *   (e.g. amber while students need a class): it tints the icon chip
 * @param {keyof typeof MARK_CLASSES} [props.mark] a solid area colour for the icon chip (dashboards);
 *   it takes precedence over `tone`
 * @param {string} [props.to] route to open on click
 * @param {() => void} [props.onClick] action on click when the row opens something on the same page (a tab)
 */
export function StatTile({ label, value, hint, icon: Icon, tone, mark, to, onClick }) {
  const isAction = Boolean(to || onClick);
  const classes =
    'flex min-h-14 items-center gap-2 rounded-tile bg-surface py-2 ring-1 ring-gray-200 ring-inset pr-2.5 pl-2 sm:gap-3 sm:pr-4';
  const content = (
    <>
      {Icon && (
        <span
          className={cx(
            'flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10',
            mark ? MARK_CLASSES[mark] : tone ? TONE_SOFT_CLASSES[tone] : 'bg-gray-100 text-gray-700',
          )}
        >
          <Icon className={mark ? 'size-5' : 'size-[1.125rem]'} aria-hidden="true" />
        </span>
      )}
      <span className={cx('min-w-0 flex-1', !Icon && 'pl-2')}>
        <span className="block text-sm leading-snug font-medium text-gray-900 sm:text-[0.9375rem]">
          {label}
        </span>
        {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
      </span>
      <span className="tabular shrink-0 text-lg font-semibold text-gray-900">{value}</span>
      {isAction && <ChevronRight className="-mr-1 size-4 shrink-0 text-gray-500" aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cx(classes, 'transition-colors hover:bg-gray-50')}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(classes, 'w-full text-left transition-colors hover:bg-gray-50')}
      >
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}
