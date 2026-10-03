import { RefreshCw, TriangleAlert } from 'lucide-react';
import { cx } from '../../utils/cx';
import { Button } from './Button';

/**
 * Shown in place of content whose first load failed (a background refetch failure is a toast).
 *   <ErrorState title="Couldn't load students" message={error.message} onRetry={refetch} />
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.message] usually `error.message`
 * @param {() => void} [props.onRetry] renders a Retry button
 * @param {boolean} [props.compact] less padding, for a state inside a small sheet
 */
export function ErrorState({ title = 'Something went wrong', message, onRetry, compact = false, className }) {
  return (
    <div
      role="alert"
      className={cx('flex flex-col items-center px-6 text-center', compact ? 'py-4' : 'py-12', className)}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-600">{message}</p>}
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-5">
          Retry
        </Button>
      )}
    </div>
  );
}
