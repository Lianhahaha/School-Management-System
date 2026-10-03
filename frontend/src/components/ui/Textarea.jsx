import { cx } from '../../utils/cx';

/** Native textarea with the same behaviour as Input (ref and native props are forwarded). */
export function Textarea({ rows = 3, className, ref, ...props }) {
  return <textarea ref={ref} rows={rows} className={cx('form-control', 'resize-y', className)} {...props} />;
}
