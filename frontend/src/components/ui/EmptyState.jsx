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
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
