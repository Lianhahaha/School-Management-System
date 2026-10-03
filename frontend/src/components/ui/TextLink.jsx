import { Link } from 'react-router';
import { cx } from '../../utils/cx';

/** In-app link styled for running text. Accepts every prop of react-router's Link. */
export function TextLink({ className, ...props }) {
  return <Link className={cx('font-medium text-brand-700 hover:underline', className)} {...props} />;
}
