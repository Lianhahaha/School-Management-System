import { cx } from '../../utils/cx';

/**
 * The yellow tag for what is happening now ("Now", "Today"). Yellow means "live or act here",
 * so use it only for the current period, today's column and similar, never for a plain status.
 */
export function LiveTag({ className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}
