import { Children, cloneElement, useId } from 'react';
import { cx } from '../../utils/cx';
import { Alert } from './Alert';

/**
 * Label, control, hint and error message for one form field, with the ids and ARIA attributes
 * wired for you: the label points at the control (htmlFor), and the control gets `id`,
 * `aria-describedby` (hint and error), `aria-invalid` and `aria-required`.
 * Wrap exactly one control (Input, Select, Textarea, ...). Field errors are plain text under the
 * field; forms should set `noValidate` and let zod do the validating.
 *
 *   <FormField label="Email" error={errors.email?.message} required>
 *     <Input {...register('email')} type="email" autoComplete="email" />
 *   </FormField>
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label
 * @param {string} [props.hint] helper text under the control
 * @param {string} [props.error] error message, usually `errors.field?.message`
 * @param {boolean} [props.required] marks the field as required (visual asterisk and aria-required)
 */
export function FormField({ label, hint, error, required = false, className, children }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  const control = cloneElement(Children.only(children), {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  });

  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The form-level error set by applyServerErrors under `root.server`. It is the only message of
 * a form with role="alert", so it is announced once without drowning screen readers in field errors.
 *   <FormRootError error={errors.root?.server} />
 */
export function FormRootError({ error, className }) {
  if (!error?.message) return null;
  return (
    <Alert tone="error" role="alert" className={className}>
      {error.message}
    </Alert>
  );
}
