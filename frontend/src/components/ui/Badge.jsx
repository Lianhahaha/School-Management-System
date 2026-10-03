import { TONE_DOT_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * Small status label: a soft grey pill with a coloured dot. The text always carries the meaning;
 * the dot only reinforces it, so a table full of statuses stays calm.
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone]
 */
export function Badge({ tone = 'gray', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-gray-700',
        className,
      )}
    >
      <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', TONE_DOT_CLASSES[tone])} />
      {children}
    </span>
  );
}
