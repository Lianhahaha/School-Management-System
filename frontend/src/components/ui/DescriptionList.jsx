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
          <dt className="text-[0.8125rem] text-gray-500">{label}</dt>
          <dd className="mt-0.5 text-[0.9375rem] text-gray-900">
            {value === null || value === undefined || value === '' ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
