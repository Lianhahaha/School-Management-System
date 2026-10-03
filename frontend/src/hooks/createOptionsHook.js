import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PAGINATION } from '../constants/shared';
import { toApiParams } from '../utils/listParams';

const OPTIONS_STALE_TIME = 5 * 60_000;

/**
 * Builds the hook behind a select: the first 100 rows (the API maximum) of a list, mapped to
 * `{ value, label, item }`. `value` is a string (what a native select holds), `item` is the full row.
 * The hook accepts extra filters, for example `search` to narrow a long list while the user types.
 * It shares the cache entry of `keys.list(params)`, so the same request is never made twice.
 *
 *   export const useTeacherOptions = createOptionsHook({
 *     keys: teacherKeys, fetchList: listTeachers, baseParams: { isActive: 'true' },
 *     toOption: (teacher) => ({ value: String(teacher.id), label: fullName(teacher), item: teacher }),
 *   });
 *   const { data: options = [], isPending } = useTeacherOptions({ search });
 *
 * @param {object} config
 * @param {{ list: (params: object) => unknown[] }} config.keys the feature's query keys
 * @param {(params: object) => Promise<{ items: object[] }>} config.fetchList the feature's list api function
 * @param {object} [config.baseParams] filters that always apply (for example active rows only)
 * @param {(row: object) => { value: string, label: string, item: object }} config.toOption
 */
export function createOptionsHook({ keys, fetchList, baseParams = {}, toOption }) {
  const select = (page) => page.items.map(toOption);

  return function useOptions(filters = {}) {
    const params = toApiParams({ ...baseParams, ...filters, limit: PAGINATION.MAX_LIMIT });
    return useQuery({
      queryKey: keys.list(params),
      queryFn: () => fetchList(params),
      select,
      staleTime: OPTIONS_STALE_TIME,
      placeholderData: keepPreviousData,
    });
  };
}
