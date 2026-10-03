import { Link } from 'react-router';
import { cx } from '../../utils/cx';

/** In-app link styled for running text and table cells. Accepts every prop of react-router's Link. */
export function TextLink({ className, ...props }) {
  return <Link className={cx('link', className)} {...props} />;
}
