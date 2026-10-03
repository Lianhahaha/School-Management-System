import { cx } from '../../utils/cx';

/**
 * White panel with an optional header (title, description, action buttons).
 * @param {object} props
 * @param {string} [props.title] rendered as an h2
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.actions] right-aligned header content
 * @param {boolean} [props.padded] set false for content that brings its own padding (a table)
 */
export function Card({ title, description, actions, padded = true, className, children }) {
  return (
    <section className={cx('rounded-card border border-gray-200 bg-white shadow-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  );
}
