import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isLiveQuery } from '../lib/liveRefresh';

const TICK_MS = 5_000;

/**
 * Oldest `dataUpdatedAt` among the live-refreshed queries on screen (ms, 0 when none): if one of them keeps
 * failing in the background, the label shows its age instead of the freshest unrelated query (a sidebar
 * count), so "Updated just now" is only shown when everything on the page is fresh.
 */
function oldestLiveUpdate(queryClient) {
  const updates = queryClient
    .getQueryCache()
    .getAll()
    .filter(
      (query) => query.getObserversCount() > 0 && query.state.status === 'success' && isLiveQuery(query),
    )
    .map((query) => query.state.dataUpdatedAt);
  return updates.length ? Math.min(...updates) : 0;
}

/**
 * When the data on screen was last loaded from the server, and the current time, both refreshed on
 * every query-cache change and every few seconds, so "12 s ago" keeps counting.
 *
 * @returns {{ updatedAt: number, now: number }} epoch milliseconds; `updatedAt` is 0 before any data
 */
export function useLastUpdatedAt() {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => ({ updatedAt: oldestLiveUpdate(queryClient), now: Date.now() }));

  useEffect(() => {
    const update = () => setState({ updatedAt: oldestLiveUpdate(queryClient), now: Date.now() });
    // The cache notifies while other components render; update after that render, not during it.
    const unsubscribe = queryClient.getQueryCache().subscribe(() => queueMicrotask(update));
    const timer = setInterval(update, TICK_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [queryClient]);

  return state;
}
