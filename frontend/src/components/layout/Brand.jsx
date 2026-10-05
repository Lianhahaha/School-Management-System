import { APP_NAME } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * The Skole mark (a ruled line over a highlighter stroke on an ink tile, same drawing as
 * public/favicon.svg) and the wordmark.
 */
/**
 * @param {object} props
 * @param {string} [props.wordmarkClassName] e.g. to hide the name on the narrowest screens
 */
export function Brand({ className, wordmarkClassName }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-gray-900" />
        <rect
          x="6.5"
          y="15"
          width="19"
          height="7.5"
          rx="2.6"
          className="fill-accent"
          transform="rotate(-8 16 18.75)"
        />
        <rect x="9" y="8.5" width="14" height="2.6" rx="1.3" className="fill-gray-50" />
      </svg>
      <span className={cx('text-xl font-semibold tracking-[-0.03em] text-gray-900', wordmarkClassName)}>{APP_NAME}</span>
    </div>
  );
}
