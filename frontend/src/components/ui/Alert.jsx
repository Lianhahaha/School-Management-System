import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { TONE_SOFT_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

const FEEDBACK = {
  success: { tone: 'green', Icon: CircleCheck },
  error: { tone: 'red', Icon: CircleAlert },
  info: { tone: 'blue', Icon: Info },
  warning: { tone: 'amber', Icon: TriangleAlert },
};

/**
 * Inline message box. It has no live-region role by default; pass role="alert" only for an error
 * that appears after the user acted (a form-level error), so screen readers announce it once.
 * @param {object} props
 * @param {'success'|'error'|'info'|'warning'} [props.tone]
 * @param {string} [props.title]
 * @param {() => void} [props.onDismiss] renders a dismiss button
 */
export function Alert({ tone = 'info', title, role, onDismiss, className, children }) {
  const { tone: color, Icon } = FEEDBACK[tone];

  return (
    <div
      role={role}
      className={cx('flex gap-3 rounded-control px-4 py-3 text-sm', TONE_SOFT_CLASSES[color], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
