import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const TICK_MS = 5_000;

/** Newest `dataUpdatedAt` among the queries the current page is showing (ms, 0 when none). */
function newestActiveUpdate(queryClient) {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.getObserversCount() > 0 && query.state.status === 'success')
    .reduce((newest, query) => Math.max(newest, query.state.dataUpdatedAt), 0);
}

/**
 * When the data on screen was last loaded from the server, and the current time, both refreshed on
 * every query-cache change and every few seconds, so "12 s ago" keeps counting.
 *
 * @returns {{ updatedAt: number, now: number }} epoch milliseconds; `updatedAt` is 0 before any data
 */
export function useLastUpdatedAt() {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => ({ updatedAt: newestActiveUpdate(queryClient), now: Date.now() }));

  useEffect(() => {
    const update = () => setState({ updatedAt: newestActiveUpdate(queryClient), now: Date.now() });
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
