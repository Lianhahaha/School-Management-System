import { useSearchParams } from 'react-router';
import { PAGINATION } from '../constants/shared';
import { toApiParams } from '../utils/listParams';

function toPositiveInt(raw, fallback) {
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * List state (page, limit, search, sorting and the page's filters) kept in the URL, so reload,
 * back/forward and shared links keep the view and every view has its own cache entry.
 *
 * Declare the filters the page offers, by their API names: the backend rejects unknown query
 * parameters, so nothing else is ever sent.
 *
 *   const list = useListParams({ filters: ['classId', 'isActive'] });
 *   const { data, isPending, isFetching, error, refetch } = useStudents(list.apiParams);
 *   <SearchInput value={list.params.search} onChange={list.setSearch} />
 *   <Select value={list.params.classId} onChange={(e) => list.setFilter('classId', e.target.value)} />
 *   <DataTable sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }} onSortChange={list.setSort} />
 *   <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
 *
 * Every setter except `setPage` also returns to page 1. Until the user sorts, no sort is sent and the
 * backend's default order applies; `defaultSort` names that order (a column's `sortKey` and its
 * direction) so the header can show it, e.g. `defaultSort: ['lastName', 'asc']`.
 *
 * @param {{ filters?: string[], defaultSort?: [string, 'asc'|'desc'] }} [options]
 */
export function useListParams({ filters = [], defaultSort } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = {
    page: toPositiveInt(searchParams.get('page'), PAGINATION.DEFAULT_PAGE),
    limit: Math.min(toPositiveInt(searchParams.get('limit'), PAGINATION.DEFAULT_LIMIT), PAGINATION.MAX_LIMIT),
    search: searchParams.get('search') ?? '',
    sortBy: searchParams.get('sortBy') ?? defaultSort?.[0] ?? null,
    sortOrder:
      searchParams.get('sortOrder') ?? (searchParams.get('sortBy') ? null : (defaultSort?.[1] ?? null)),
    ...Object.fromEntries(filters.map((filter) => [filter, searchParams.get(filter) ?? ''])),
  };

  /** Patch semantics: '', null and undefined delete the key; any change but a page change resets to page 1. */
  const update = (patch) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (value === '' || value === null || value === undefined) next.delete(key);
          else next.set(key, String(value));
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  return {
    /** Current values for rendering controls (filters are '' when unset). */
    params,
    /** `params` without empty values: pass it to the feature hook (query key and request). */
    apiParams: toApiParams({
      ...params,
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    }),
    /** True when the search box or any declared filter has a value. */
    hasActiveFilters: params.search !== '' || filters.some((filter) => params[filter] !== ''),
    setPage: (page) => update({ page }),
    setLimit: (limit) => update({ limit }),
    setSearch: (search) => update({ search }),
    setSort: (sortBy, sortOrder) => update({ sortBy, sortOrder }),
    setFilter: (key, value) => update({ [key]: value }),
    clearFilters: () => update(Object.fromEntries(['search', ...filters].map((key) => [key, '']))),
  };
}
