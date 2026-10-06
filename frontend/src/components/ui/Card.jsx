import { MARK_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * A sheet (white surface on the grey page) with an optional header: title, running total,
 * description and action buttons.
 * @param {object} props
 * @param {string} [props.title] rendered as an h2
 * @param {import('react').ReactNode} [props.total] short running total beside the title, e.g. "3 of 4 marked"
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.actions] right-aligned header content
 * @param {boolean} [props.padded] set false for content that brings its own padding (a table)
 * @param {import('react').ElementType} [props.icon] lucide icon in a coloured square before the title
 * @param {keyof typeof MARK_CLASSES} [props.mark] colour of that square: the area of the school
 */
export function Card({
  title,
  total,
  description,
  actions,
  padded = true,
  icon: Icon,
  mark = 'ink',
  className,
  children,
}) {
  const hasHeader = Boolean(title || actions);

  return (
    <section className={cx('sheet', className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h2
                className={cx(
                  'flex flex-wrap gap-x-2 text-base font-semibold text-gray-900',
                  Icon ? 'items-center gap-y-1' : 'items-baseline',
                )}
              >
                {Icon && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                      MARK_CLASSES[mark],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                )}
                {title}
                {total !== undefined && total !== null && (
                  <span className="tabular text-sm font-normal text-gray-500">{total}</span>
                )}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : hasHeader ? 'pt-3' : undefined}>{children}</div>
    </section>
  );
}
