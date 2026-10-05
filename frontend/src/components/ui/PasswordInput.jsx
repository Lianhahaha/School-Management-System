import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../../utils/cx';
import { Input } from './Input';

/**
 * Password field with an eye button that shows or hides what was typed, so typos can be spotted.
 * It takes the same props as Input (ref, `register`, FormField's id and ARIA attributes), and the
 * password is hidden again whenever the field is rendered fresh.
 *
 *   <FormField label="Password" error={errors.password?.message} required>
 *     <PasswordInput {...register('password')} autoComplete="new-password" />
 *   </FormField>
 */
export function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cx('pr-12', className)} />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        // Keep the caret in the field when the eye is tapped with a mouse or finger.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 pointer-coarse:right-0 pointer-coarse:size-11"
      >
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </button>
    </div>
  );
}
