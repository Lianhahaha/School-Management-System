import { useId } from 'react';
import { cx } from '../../utils/cx';

/**
 * Labelled checkbox. Works with react-hook-form: <Checkbox {...register('isActive')} label="Active" />.
 * @param {object} props
 * @param {import('react').ReactNode} props.label
 * @param {string} [props.hint] helper text under the label
 */
export function Checkbox({ label, hint, className, ref, ...props }) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-4 shrink-0 rounded border-gray-300 accent-brand-600"
        {...props}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-gray-700">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-gray-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
