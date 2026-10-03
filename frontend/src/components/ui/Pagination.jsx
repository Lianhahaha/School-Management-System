import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGINATION } from '../../constants/shared';
import { PAGE_SIZES } from '../../constants/ui';
import { Button } from './Button';
import { Select } from './Select';

const ELLIPSIS = '…';

/** At most seven entries: the first and last page, the neighbours of the current page and gaps. */
function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, ELLIPSIS, totalPages];
  if (page >= totalPages - 3)
    return [1, ELLIPSIS, ...Array.from({ length: 5 }, (_, index) => totalPages - 4 + index)];
  return [1, ELLIPSIS, page - 1, page, page + 1, ELLIPSIS, totalPages];
}

/**
 * "Showing 21-40 of 132", previous/next, up to seven page buttons and a page-size select.
 * Renders nothing while `meta` is missing, when there are no rows, or when everything fits on one
 * page at the default page size.
 *
 * @param {object} props
 * @param {{ page: number, limit: number, total: number, totalPages: number }} [props.meta] from the list response
 * @param {(page: number) => void} props.onPageChange
 * @param {(limit: number) => void} props.onLimitChange
 */
export function Pagination({ meta, onPageChange, onLimitChange }) {
  if (!meta || meta.total === 0) return null;
  const { page, limit, total, totalPages } = meta;
  if (totalPages <= 1 && limit === PAGINATION.DEFAULT_LIMIT) return null;

  // A hand-edited URL may carry a page size the select does not offer.
  const pageSizes = PAGE_SIZES.includes(limit) ? PAGE_SIZES : [...PAGE_SIZES, limit].sort((a, b) => a - b);
  const sizeOptions = pageSizes.map((size) => ({ value: size, label: String(size) }));

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-gray-600">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-gray-600">
          Rows per page
          <Select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            options={sizeOptions}
            className="w-20"
          />
        </label>

        <ul className="flex items-center gap-1">
          <li>
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronLeft}
              disabled={page <= 1}
              onClick={() => onPageChange(Math.min(page - 1, totalPages))}
              aria-label="Previous page"
            />
          </li>
          {pageItems(page, totalPages).map((item, index) => (
            <li key={item === ELLIPSIS ? `gap-${index}` : item}>
              {item === ELLIPSIS ? (
                <span aria-hidden="true" className="px-2 text-gray-400">
                  {ELLIPSIS}
                </span>
              ) : (
                <Button
                  variant={item === page ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  className="min-w-9 px-2"
                >
                  {item}
                </Button>
              )}
            </li>
          ))}
          <li>
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronRight}
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            />
          </li>
        </ul>
      </div>
    </nav>
  );
}
