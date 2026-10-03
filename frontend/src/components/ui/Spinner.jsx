import { LoaderCircle } from 'lucide-react';
import { cx } from '../../utils/cx';

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-8' };

/**
 * Spinning loader. Pass `label` when the spinner is the only thing telling the user that
 * something is loading (it is announced as a status); omit it inside buttons and other
 * elements that already carry a label.
 */
export function Spinner({ size = 'md', label, className }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex">
      <LoaderCircle className={cx('animate-spin', SIZES[size], className)} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
