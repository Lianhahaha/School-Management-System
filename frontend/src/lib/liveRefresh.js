/**
 * Keeps the data on screen current while other people change it. Every few seconds, and when the tab
 * becomes visible again, the queries of the page being looked at are fetched again; a fresh answer
 * replaces the old one in place, so nothing flickers and no form loses its input.
 *
 * Left alone on purpose:
 *   - hidden tabs, offline browsers and moments when a save is running (nothing to compare against);
 *   - /auth/me, which AuthProvider refreshes on its own and treats a failed fetch as a sign-in problem;
 *   - queries with `meta: { live: false }`: the attendance and grade sheets, which a teacher is editing, and
 *     reference data that rarely changes (picker options, a lesson's or assessment's header, school years);
 *     the app's own saves still refresh those.
 *
 * A failed background fetch is silent and is not retried: the next round tries again. Every fetch of a round is
 * tagged (its fetch meta is LIVE_REFRESH), and only tagged fetches are treated that way (isLiveRefreshFetch and
 * liveRefreshBehavior, used by lib/queryClient): a page's own fetch that fails while a round runs still retries
 * and still raises its toast.
 */
import { authKeys } from '../features/auth/keys';

const INTERVAL_MS = 20_000;

/** The fetch meta of every fetch a round starts; TanStack keeps it in `query.state.fetchMeta` until the next fetch. */
const LIVE_REFRESH = Object.freeze({ liveRefresh: true });

/** A round is running; only used so that rounds never overlap, and for showsFetching. */
let isRefreshing = false;

/** True when the query's current (or last) fetch was started by a background round rather than by the page. */
export const isLiveRefreshFetch = (query) => query.state.fetchMeta === LIVE_REFRESH;

/**
 * Query `behavior` for the QueryClient defaults: a fetch of a background round does not retry, because the next
 * round, 20 s later, is the retry. TanStack calls `onFetch` before it builds the fetch's retryer, which takes
 * `retry` from `context.options`; replacing that object changes this one fetch, never the query's own options.
 */
export const liveRefreshBehavior = {
  onFetch: (context) => {
    if (context.fetchOptions?.meta === LIVE_REFRESH) context.options = { ...context.options, retry: false };
  },
};

/**
 * `isFetching` for display: a background refresh is not worth dimming a table or showing a spinner for. It reads
 * the round as a whole (a page fetch during a round is not dimmed either); that only affects the look.
 */
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
      // A query already being fetched (after a save, say) is left to finish rather than fetched twice, and keeps
      // that fetch's tag. refetchQueries hands these options, the tag included, to each query's fetch.
      await queryClient.refetchQueries(
        { type: 'active', predicate: isLiveQuery },
        { cancelRefetch: false, meta: LIVE_REFRESH },
      );
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
