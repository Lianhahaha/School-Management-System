import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cx } from '../../utils/cx';

/*
 * Table primitives with the shared look. DataTable composes them; use them directly only for
 * small static tables that need no loading, sorting or empty state.
 */

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };

/** Hides a column below a breakpoint: `hideBelow="md"` drops it on phones. */
const HIDE_BELOW = { sm: 'max-sm:hidden', md: 'max-md:hidden', lg: 'max-lg:hidden' };

const SORT_ICONS = { asc: ArrowUp, desc: ArrowDown };
const ARIA_SORT = { asc: 'ascending', desc: 'descending' };

/** @param {{ caption?: string }} props `caption` is the accessible name of the table (screen readers only) */
export function Table({ caption, className, children }) {
  return (
    <table className={cx('min-w-full text-left text-sm', className)}>
      {caption && <caption className="sr-only">{caption}</caption>}
      {children}
    </table>
  );
}

export function THead({ children }) {
  return <thead className="bg-gray-50 text-xs tracking-wide text-gray-600 uppercase">{children}</thead>;
}

export function TBody({ className, children, ...props }) {
  return (
    <tbody className={cx('divide-y divide-gray-100 bg-white', className)} {...props}>
      {children}
    </tbody>
  );
}

export function Tr({ children }) {
  return <tr className="hover:bg-gray-50/60">{children}</tr>;
}

/**
 * Column header. Pass `onSort` to make it sortable: the label becomes a button inside the <th>
 * and `aria-sort` reflects `sortDirection` ('asc', 'desc' or null when another column is sorted).
 * @param {object} props
 * @param {'asc'|'desc'|null} [props.sortDirection]
 * @param {() => void} [props.onSort]
 * @param {'left'|'center'|'right'} [props.align]
 * @param {'sm'|'md'|'lg'} [props.hideBelow]
 * @param {string|number} [props.width] CSS width of the column
 */
export function Th({ sortDirection = null, onSort, align = 'left', hideBelow, width, className, children }) {
  const SortIcon = SORT_ICONS[sortDirection] ?? ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={onSort ? (ARIA_SORT[sortDirection] ?? 'none') : undefined}
      style={width ? { width } : undefined}
      className={cx('px-4 py-3 font-semibold', ALIGN[align], hideBelow && HIDE_BELOW[hideBelow], className)}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 tracking-wide uppercase hover:text-gray-900"
        >
          {children}
          <SortIcon className={cx('size-3.5', !sortDirection && 'opacity-40')} aria-hidden="true" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** @param {{ align?: 'left'|'center'|'right', hideBelow?: 'sm'|'md'|'lg', colSpan?: number }} props */
export function Td({ align = 'left', hideBelow, className, children, ...props }) {
  return (
    <td
      className={cx('px-4 py-3 text-gray-700', ALIGN[align], hideBelow && HIDE_BELOW[hideBelow], className)}
      {...props}
    >
      {children}
    </td>
  );
}
