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
 */
export function Card({ title, total, description, actions, padded = true, className, children }) {
  const hasHeader = Boolean(title || actions);

  return (
    <section className={cx('sheet', className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-gray-900">
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
