import { cx } from '../../utils/cx';

/**
 * Native text-like input. It forwards its ref and every native prop, so it works with
 * react-hook-form's `register`: <Input {...register('email')} type="email" />.
 * Wrap it in a FormField to get a label, hint and error wired up.
 */
export function Input({ type = 'text', className, ref, ...props }) {
  return <input ref={ref} type={type} className={cx('form-control', className)} {...props} />;
}
