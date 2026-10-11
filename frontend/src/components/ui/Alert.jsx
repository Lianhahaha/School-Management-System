import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from '../../utils/cx';

/** The icon and its colour per tone; the box itself is the same flat grey for every tone. */
const FEEDBACK = {
  success: { iconClass: 'text-positive', Icon: CircleCheck },
  error: { iconClass: 'text-attention-ink', Icon: CircleAlert },
  info: { iconClass: 'text-gray-600', Icon: Info },
  warning: { iconClass: 'text-mark-oxblood dark:text-mark-cream', Icon: TriangleAlert },
};

/**
 * Inline message box: a flat grey well with a coloured icon, no tinted wash, so the words carry the message.
 * It has no live-region role by default; pass role="alert" only for an error
 * that appears after the user acted (a form-level error), so screen readers announce it once.
 * @param {object} props
 * @param {'success'|'error'|'info'|'warning'} [props.tone]
 * @param {string} [props.title]
 * @param {() => void} [props.onDismiss] renders a dismiss button
 */
export function Alert({ tone = 'info', title, role, onDismiss, className, children }) {
  const { iconClass, Icon } = FEEDBACK[tone];

  return (
    <div
      role={role}
      className={cx(
        'flex gap-3 rounded-control bg-well px-4 py-3 text-sm text-gray-900 ring-1 ring-well-edge ring-inset',
        className,
      )}
    >
      <Icon className={cx('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-gray-900/5 pointer-coarse:-m-2.5 pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
