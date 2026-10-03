import { cx } from '../../utils/cx';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';
import { TBody, THead, Table, Td, Th, Tr } from './Table';

/**
 * Table driven by a column configuration. It knows nothing about the data: pages pass columns
 * and rows (see useListParams for the matching list state).
 *
 *   <DataTable
 *     label="Students"
 *     columns={[
 *       { key: 'studentNumber', header: 'Student no', sortKey: 'studentNumber' },
 *       { key: 'name', header: 'Name', sortKey: 'lastName', cell: (s) => fullName(s) },
 *       { key: 'email', header: 'Email', hideBelow: 'md' },
 *     ]}
 *     rows={data?.items ?? []}
 *     isLoading={isPending} isFetching={isFetching} error={error} onRetry={refetch}
 *     sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }} onSortChange={list.setSort}
 *     emptyState={<EmptyState title="No students yet" />}
 *   />
 *
 * Column: `key` (also the default cell value, `row[key]`), `header`, `cell(row)` (custom content),
 * `sortKey` (an entry of the API's sort whitelist; makes the header clickable), `align`
 * ('left' | 'center' | 'right'), `width`, `hideBelow` ('sm' | 'md' | 'lg').
 *
 * States: `isLoading` (first load) shows skeleton rows; `isFetching` (refetch) dims the rows and
 * keeps them; `error` with no rows replaces the body with an ErrorState (a failed background
 * refetch keeps the rows and is a toast); no rows shows `emptyState`.
 * Clicking a sortable header sorts ascending first, then toggles.
 *
 * @param {object} props
 * @param {string} [props.label] accessible name of the table
 * @param {string|((row: object) => string|number)} [props.rowKey] row id field or function (default 'id')
 * @param {{ sortBy: string|null, sortOrder: string|null }} [props.sort]
 * @param {(sortKey: string, sortOrder: 'asc'|'desc') => void} [props.onSortChange]
 */
export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  label,
  isLoading = false,
  isFetching = false,
  error = null,
  onRetry,
  sort,
  onSortChange,
  emptyState,
  skeletonRows = 8,
}) {
  const getRowKey = typeof rowKey === 'function' ? rowKey : (row) => row[rowKey];
  const sortBy = sort?.sortBy ?? null;
  const sortOrder = sort?.sortOrder ?? 'asc';

  const sortHandlerOf = (column) =>
    column.sortKey && onSortChange
      ? () => onSortChange(column.sortKey, sortBy === column.sortKey && sortOrder === 'asc' ? 'desc' : 'asc')
      : undefined;

  /** One full-width row for the error and empty states, so the header stays visible. */
  const statusRow = (content) => (
    <Tr>
      <Td colSpan={columns.length} className="p-0">
        {content}
      </Td>
    </Tr>
  );

  let body;
  if (isLoading) {
    body = Array.from({ length: skeletonRows }, (_, index) => (
      <Tr key={index}>
        {columns.map((column) => (
          <Td key={column.key} align={column.align} hideBelow={column.hideBelow}>
            <Skeleton className="h-4 w-3/4" />
          </Td>
        ))}
      </Tr>
    ));
  } else if (error && rows.length === 0) {
    body = statusRow(<ErrorState title="Couldn't load the data" message={error.message} onRetry={onRetry} />);
  } else if (rows.length === 0) {
    body = statusRow(emptyState ?? <EmptyState title="Nothing to show" />);
  } else {
    body = rows.map((row) => (
      <Tr key={getRowKey(row)}>
        {columns.map((column) => (
          <Td key={column.key} align={column.align} hideBelow={column.hideBelow}>
            {column.cell ? column.cell(row) : row[column.key]}
          </Td>
        ))}
      </Tr>
    ));
  }

  return (
    <div className="sheet overflow-hidden pt-3 pb-1">
      <div
        // relative: the sr-only header text is absolutely positioned and would otherwise escape the scroll box
        className="relative overflow-x-auto"
        tabIndex={0}
        role={label ? 'region' : undefined}
        aria-label={label}
        aria-busy={isLoading || isFetching}
      >
        <Table caption={label}>
          <THead>
            <Tr>
              {columns.map((column) => (
                <Th
                  key={column.key}
                  align={column.align}
                  width={column.width}
                  hideBelow={column.hideBelow}
                  sortDirection={sortBy === column.sortKey ? sortOrder : null}
                  onSort={sortHandlerOf(column)}
                >
                  {column.header}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody className={cx('transition-opacity', isFetching && !isLoading && 'opacity-60')}>{body}</TBody>
        </Table>
      </div>
    </div>
  );
}
