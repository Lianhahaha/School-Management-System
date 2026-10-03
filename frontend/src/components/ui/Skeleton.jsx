import { cx } from '../../utils/cx';

/** Grey pulsing placeholder; size it with `className` (for example "h-4 w-1/2"). */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-gray-200', className)} />;
}
