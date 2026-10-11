import { useEffect, useRef } from 'react';
import { showsFetching } from '../../lib/liveRefresh';
import { cx } from '../../utils/cx';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { TBody, THead, Table, Td, Th, Tr } from './Table';

/** Columns a table would hide on a phone are left out of the cards too. */
const showsOnPhone = (column) => !column.hideBelow || column.hideBelow === 'sm';
const isActions = (column) => column.key === 'actions';
const primaryOf = (columns) =>
  columns.find((column) => column.primary) ??
  columns.find((column) => ['name', 'title', 'subject'].includes(column.key)) ??
  columns[0];

/** "Sort by" for the phone cards, built from the sortable columns with plain-text headers. */
function MobileSort({ columns, sortBy, sortOrder, onSortChange }) {
  const sortable = columns.filter((column) => column.sortKey && typeof column.header === 'string');
  if (!onSortChange || sortable.length === 0) return null;
  const options = sortable.flatMap((column) => [
    { value: `${column.sortKey}:asc`, label: `${column.header}, ascending` },
    { value: `${column.sortKey}:desc`, label: `${column.header}, descending` },
  ]);
  return (
    <div className="mb-3 sm:hidden">
      <Select
        aria-label="Sort by"
        value={sortBy ? `${sortBy}:${sortOrder}` : ''}
        onChange={(event) => {
          const [key, order] = event.target.value.split(':');
          if (key) onSortChange(key, order);
        }}
        options={options}
        placeholder="Sort by"
        className="border-transparent"
      />
    </div>
  );
}

/**
 * The row a link pointed at (a notification's `?user=7`): a flat well with the yellow "you are here" edge,
 * announced as the current one. `data-highlighted` is how DataTable finds it to scroll it into view.
 */
const HIGHLIGHTED_CARD_CLASS = 'bg-well shadow-[inset_3px_0_0_var(--accent)]';
// A table row draws no shadow of its own, so its first cell carries the edge.
const HIGHLIGHTED_ROW_CLASS = 'bg-well [&>td:first-child]:shadow-[inset_3px_0_0_var(--accent)]';
const HIGHLIGHTED_ROW_ATTRIBUTES = Object.freeze({ 'aria-current': 'true', 'data-highlighted': '' });

/** Row keys are numbers or strings, a key from the URL is a string: compare them as text. */
const isSameKey = (rowKey, highlightedRowKey) =>
  highlightedRowKey !== undefined &&
  highlightedRowKey !== null &&
  String(rowKey) === String(highlightedRowKey);

/** The rows as cards, for phones. */
function CardList({ columns, rows, getRowKey, label, highlightedRowKey }) {
  const primary = primaryOf(columns);
  const actions = columns.find(isActions);
  const details = columns.filter(
    (column) => column !== primary && !isActions(column) && showsOnPhone(column),
  );
  const valueOf = (column, row) => (column.cell ? column.cell(row) : row[column.key]);

  return (
    <ul aria-label={label} className="divide-y divide-gray-200">
      {rows.map((row) => {
        const isHighlighted = isSameKey(getRowKey(row), highlightedRowKey);
        return (
          <li
            key={getRowKey(row)}
            {...(isHighlighted ? HIGHLIGHTED_ROW_ATTRIBUTES : {})}
            className={cx('space-y-2 px-4 py-3.5', isHighlighted && HIGHLIGHTED_CARD_CLASS)}
          >
            <div className="text-[0.9375rem] font-medium text-gray-900">{valueOf(primary, row)}</div>
            {details.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {details.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className="text-gray-500">{column.header}</dt>
                    <dd className="min-w-0 text-gray-800">{valueOf(column, row) ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="flex flex-wrap justify-end gap-1 pt-1">{valueOf(actions, row)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Scrolls the highlighted row into view once per key, in whichever of the two layouts (cards on phones, the
 * table above) is on screen. Returns the refs of those two containers.
 */
function useScrollToHighlighted(highlightedRowKey, isShown) {
  const cardsRef = useRef(null);
  const tableRef = useRef(null);
  const scrolledTo = useRef(null);

  useEffect(() => {
    if (!isShown || scrolledTo.current === highlightedRowKey) return;
    const row = [cardsRef.current, tableRef.current]
      .map((container) => container?.querySelector('[data-highlighted]'))
      .find((element) => element && element.offsetParent !== null);
    if (!row) return;
    scrolledTo.current = highlightedRowKey;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedRowKey, isShown]);

  return { cardsRef, tableRef };
}

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
 * ('left' | 'center' | 'right'), `width`, `hideBelow` ('sm' | 'md' | 'lg'), `primary` (the card title
 * on phones; default the `name`, `title` or `subject` column, else the first).
 *
 * Phones (below `sm`): each row becomes a card instead of a table row: the primary column as the
 * title, the other columns that a phone-width table would show (no `hideBelow` other than 'sm') as
 * label and value, and the `actions` column at the bottom. Sorting moves into a "Sort by" select.
 *
 * States: `isLoading` (first load) shows skeleton rows; `isFetching` (refetch) dims the rows and
 * keeps them; `error` with no rows replaces the body with an ErrorState (a failed background
 * refetch keeps the rows and is a toast); no rows shows `emptyState`.
 * Clicking a sortable header sorts ascending first, then toggles.
 *
 * `highlightedRowKey` marks the row a link pointed at (a notification opening `?user=7`): it is set apart and
 * scrolled into view once it is on the page.
 *
 * @param {object} props
 * @param {string} [props.label] accessible name of the table
 * @param {string|((row: object) => string|number)} [props.rowKey] row id field or function (default 'id')
 * @param {{ sortBy: string|null, sortOrder: string|null }} [props.sort]
 * @param {(sortKey: string, sortOrder: 'asc'|'desc') => void} [props.onSortChange]
 * @param {string|number|null} [props.highlightedRowKey] the key of the row to set apart
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
  highlightedRowKey = null,
}) {
  const getRowKey = typeof rowKey === 'function' ? rowKey : (row) => row[rowKey];
  const sortBy = sort?.sortBy ?? null;
  const sortOrder = sort?.sortOrder ?? 'asc';
  const isHighlightShown = !isLoading && rows.some((row) => isSameKey(getRowKey(row), highlightedRowKey));
  const { cardsRef, tableRef } = useScrollToHighlighted(highlightedRowKey, isHighlightShown);

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
    body = rows.map((row) => {
      const isHighlighted = isSameKey(getRowKey(row), highlightedRowKey);
      return (
        <Tr
          key={getRowKey(row)}
          {...(isHighlighted ? HIGHLIGHTED_ROW_ATTRIBUTES : {})}
          className={isHighlighted ? HIGHLIGHTED_ROW_CLASS : undefined}
        >
          {columns.map((column) => (
            <Td key={column.key} align={column.align} hideBelow={column.hideBelow}>
              {column.cell ? column.cell(row) : row[column.key]}
            </Td>
          ))}
        </Tr>
      );
    });
  }

  let cards;
  if (isLoading) {
    cards = (
      <div className="space-y-4 p-4">
        {Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  } else if (error && rows.length === 0) {
    cards = <ErrorState title="Couldn't load the data" message={error.message} onRetry={onRetry} />;
  } else if (rows.length === 0) {
    cards = emptyState ?? <EmptyState title="Nothing to show" />;
  } else {
    cards = (
      <CardList
        columns={columns}
        rows={rows}
        getRowKey={getRowKey}
        label={label}
        highlightedRowKey={highlightedRowKey}
      />
    );
  }
  const dimmed = showsFetching(isFetching) && !isLoading;

  return (
    <>
      <MobileSort columns={columns} sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
      <div
        ref={cardsRef}
        className={cx('sheet overflow-hidden transition-opacity sm:hidden', dimmed && 'opacity-60')}
        aria-busy={isLoading || dimmed}
      >
        {cards}
      </div>
      <div ref={tableRef} className="sheet overflow-hidden pt-3 pb-1 max-sm:hidden">
        <div
          // relative: the sr-only header text is absolutely positioned and would otherwise escape the scroll box
          className="relative overflow-x-auto"
          tabIndex={0}
          role={label ? 'region' : undefined}
          aria-label={label}
          aria-busy={isLoading || dimmed}
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
            <TBody className={cx('transition-opacity', dimmed && 'opacity-60')}>{body}</TBody>
          </Table>
        </div>
      </div>
    </>
  );
}
