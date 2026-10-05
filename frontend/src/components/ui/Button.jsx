import { cx } from '../../utils/cx';
import { Spinner } from './Spinner';

/*
 * Pills. Yellow is the primary action only, so a screen carries one (or very few) yellow buttons;
 * everything else is a soft grey pill or plain text. Disabled buttons keep their shape and fade.
 */
const VARIANTS = {
  primary: 'bg-accent font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50',
  secondary: 'bg-gray-100 font-medium text-gray-900 hover:bg-gray-200 disabled:text-gray-500',
  ghost:
    'font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-400 disabled:hover:bg-transparent',
  danger: 'bg-red-600 font-semibold text-on-danger hover:bg-red-700 disabled:opacity-50',
  /** A destructive row action that still sits quietly in a table (Deactivate); it confirms before acting. */
  dangerGhost:
    'font-medium text-red-700 hover:bg-red-50 disabled:text-gray-400 disabled:hover:bg-transparent',
};

// Heights keep touch targets at 44 px or more on touch screens; with a mouse the small size is 36 px.
const SIZES = {
  sm: 'h-9 px-3.5 text-sm pointer-coarse:h-11',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-12 px-6 text-base',
};

/** A button with an icon and no label is a circle of the same height. */
const ICON_ONLY = { sm: 'w-9 px-0 pointer-coarse:w-11', md: 'w-11 px-0', lg: 'w-12 px-0' };

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'dangerGhost'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.isLoading] shows a spinner, disables the button and sets aria-busy
 * @param {import('react').ElementType} [props.icon] lucide icon shown before the label
 * @param {import('react').ElementType} [props.as] render another element, for example `as={Link} to="/x"`
 *
 * A native button defaults to type="button" so that it never submits a form by accident;
 * the primary action of a form passes type="submit". An icon-only button needs an aria-label.
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
  const isIconOnly = Boolean(Icon) && (children === undefined || children === null || children === false);

  return (
    <Component
      {...props}
      {...nativeProps}
      aria-busy={isLoading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full whitespace-nowrap transition-[background-color,color,transform] duration-150 select-none active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        isIconOnly && ICON_ONLY[size],
        className,
      )}
    >
      {isLoading ? <Spinner size="sm" /> : Icon && <Icon className="size-[1.125rem]" aria-hidden="true" />}
      {children}
    </Component>
  );
}
