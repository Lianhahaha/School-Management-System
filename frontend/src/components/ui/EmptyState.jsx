import { Inbox } from 'lucide-react';
import { cx } from '../../utils/cx';

/**
 * Shown where a list or section has nothing to display. Pages choose between two flavours:
 * "nothing exists yet" (title plus a primary action) and "no match for the filters"
 * (title plus a Clear filters action).
 * @param {object} props
 * @param {import('react').ElementType} [props.icon] lucide icon
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.action] usually a Button
 * @param {boolean} [props.compact] one quiet row, for a state inside a small dashboard sheet
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false, className }) {
  return (
    <div
      className={cx(
        compact
          ? 'flex items-center gap-3 rounded-[1.25rem] bg-well p-3 text-left ring-1 ring-well-edge ring-inset'
          : 'flex flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <span
        className={cx(
          'flex shrink-0 items-center justify-center text-gray-600',
          compact ? 'size-10 rounded-lg bg-well-chip' : 'size-14 rounded-xl bg-gray-100',
        )}
      >
        <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden="true" />
      </span>
      <div className={compact ? 'min-w-0' : undefined}>
        <h3 className={cx('font-semibold text-gray-900', compact ? 'text-sm' : 'mt-4 text-base')}>{title}</h3>
        {description && (
          <p className={cx('text-sm text-gray-600', compact ? 'mt-0.5' : 'mx-auto mt-1 max-w-sm')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className={compact ? 'ml-auto shrink-0' : 'mt-5'}>{action}</div>}
    </div>
  );
}
