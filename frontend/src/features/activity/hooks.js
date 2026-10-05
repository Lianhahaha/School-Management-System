/**
 * The activity log (admin).
 *
 *   useActivity(params, { enabled })  a page of entries, newest first; params: page, limit, search, sortBy,
 *                                     sortOrder, area, actorId, dateFrom, dateTo
 *
 * Read only: entries are written by the API itself after every change, so the live refresh keeps the list
 * current and no mutation needs to invalidate it.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listActivity } from './api';
import { activityKeys } from './keys';

export function useActivity(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => listActivity(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}
