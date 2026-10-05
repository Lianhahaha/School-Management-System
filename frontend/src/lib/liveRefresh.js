/**
 * Keeps the data on screen current while other people change it. Every few seconds, and when the tab
 * becomes visible again, the queries of the page being looked at are fetched again; a fresh answer
 * replaces the old one in place, so nothing flickers and no form loses its input.
 *
 * Left alone on purpose:
 *   - hidden tabs, offline browsers and moments when a save is running (nothing to compare against);
 *   - /auth/me, which AuthProvider refreshes on its own and treats a failed fetch as a sign-in problem;
 *   - queries with `meta: { live: false }`: the attendance and grade sheets, which a teacher is editing.
 *
 * A failed background fetch is silent (see isLiveRefreshing in queryClient): the next round tries again.
 */
import { authKeys } from '../features/auth/keys';

const INTERVAL_MS = 20_000;

let isRefreshing = false;

export const isLiveRefreshing = () => isRefreshing;

/** `isFetching` for display: a background refresh is not worth dimming a table or showing a spinner for. */
export const showsFetching = (isFetching) => isFetching && !isRefreshing;

const isAuthMe = (query) => query.queryKey[0] === authKeys.all[0];

/** True for the queries this loop refreshes (everything but /auth/me and `meta: { live: false }`). */
export const isLiveQuery = (query) => query.meta?.live !== false && !isAuthMe(query);

/** Starts the refresh loop for `queryClient`; returns a function that stops it. */
export function startLiveRefresh(queryClient) {
  async function refresh() {
    if (isRefreshing || document.hidden || !navigator.onLine || queryClient.isMutating() > 0) return;
    isRefreshing = true;
    try {
      await queryClient.refetchQueries({ type: 'active', predicate: isLiveQuery });
    } finally {
      isRefreshing = false;
    }
  }

  const onVisibilityChange = () => {
    if (!document.hidden) refresh();
  };

  const timer = setInterval(refresh, INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', refresh);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', refresh);
  };
}
