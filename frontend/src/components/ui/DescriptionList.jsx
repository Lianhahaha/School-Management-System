import { cx } from '../../utils/cx';

/**
 * Read-only label/value pairs as a semantic <dl>, for profile and detail sections.
 * Empty values (null, undefined, '') render as an em dash.
 * @param {object} props
 * @param {Array<{ label: string, value: import('react').ReactNode }>} props.items
 */
export function DescriptionList({ items, className }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {value === null || value === undefined || value === '' ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
