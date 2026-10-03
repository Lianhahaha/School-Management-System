import { TONE_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * Small status label. The text always carries the meaning; the tone only reinforces it.
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone]
 */
export function Badge({ tone = 'gray', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
