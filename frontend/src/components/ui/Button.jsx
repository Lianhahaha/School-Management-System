import { cx } from '../../utils/cx';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
  ghost: 'text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
};

// Heights keep touch targets at 36 px or more (40 px for the default size).
const SIZES = { sm: 'h-9 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-base' };

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.isLoading] shows a spinner, disables the button and sets aria-busy
 * @param {import('react').ElementType} [props.icon] lucide icon shown before the label
 * @param {import('react').ElementType} [props.as] render another element, for example `as={Link} to="/x"`
 *
 * A native button defaults to type="button" so that it never submits a form by accident;
 * the primary action of a form passes type="submit".
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon: Icon,
  className,
  children,
  ...props
}) {
  const nativeProps =
    Component === 'button' ? { type: props.type ?? 'button', disabled: props.disabled || isLoading } : {};

  return (
    <Component
      {...props}
      {...nativeProps}
      aria-busy={isLoading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {isLoading ? <Spinner size="sm" /> : Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </Component>
  );
}
