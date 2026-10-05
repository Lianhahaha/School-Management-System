import { RefreshCw } from 'lucide-react';
import { useLastUpdatedAt } from '../../hooks/useLastUpdatedAt';
import { formatDateTime } from '../../utils/date';
import { cx } from '../../utils/cx';

/** 4 s -> 'just now', 25 s -> '25 s ago', 3 min -> '3 min ago'. */
function ago(milliseconds) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}

/**
 * Quiet "Updated 12 s ago" in the top bar, so people can trust that the page refreshes itself
 * (see lib/liveRefresh). It is not a live region: it changes every few seconds and would be noise.
 */
export function LastUpdated({ className }) {
  const { updatedAt, now } = useLastUpdatedAt();
  if (!updatedAt) return null;

  return (
    <p
      className={cx('flex items-center gap-1.5 text-xs text-gray-500', className)}
      title={`Data loaded at ${formatDateTime(new Date(updatedAt).toISOString())}. Pages refresh themselves about every 20 seconds.`}
    >
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Updated {ago(now - updatedAt)}
    </p>
  );
}
