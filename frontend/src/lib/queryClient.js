/**
 * The one QueryClient, with the app-wide error policy:
 *
 *   queries    first-load failures render an inline ErrorState in the page; a failed background
 *              refetch (data already on screen) raises a toast.
 *   mutations  raise a toast, except errors a form renders next to its fields (isInlineFormError)
 *              and mutations that opt out with `meta: { silent: true }` because their form shows
 *              every error itself (sign-in, registration, profile).
 *
 * A background refresh (lib/liveRefresh) never toasts and never retries: the next round simply tries again.
 * Its fetches are tagged, so a page's own fetch that fails while a round runs still retries and toasts.
 *
 * A 403 may mean the account changed (disabled, removed): /auth/me is re-fetched so that
 * AuthProvider can sign the user out with a message. Those account codes never toast.
 */
import { MutationCache, QueryCache, QueryClient, matchQuery } from '@tanstack/react-query';
import { FORCE_SIGN_OUT_CODES } from '../constants/ui';
import { authKeys } from '../features/auth/keys';
import { isInlineFormError } from './formErrors';
import { isLiveRefreshFetch, liveRefreshBehavior } from './liveRefresh';
import { toastBus } from './toastBus';

const MAX_RETRIES = 2;

function refreshAccountOn403(error) {
  if (error?.status === 403) queryClient.invalidateQueries({ queryKey: authKeys.me() });
}

const isAccountError = (error) => FORCE_SIGN_OUT_CODES.includes(error?.code);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Any Error can land here (fetchAllPages throws a plain one); only an ApiError has isTransient.
      retry: (failureCount, error) =>
        Boolean(/** @type {Partial<import('./apiClient').ApiError>} */ (error)?.isTransient) &&
        failureCount < MAX_RETRIES,
      // A background refresh does not retry: the next round, 20 s later, is the retry. This turns `retry` off
      // for the fetches of a round only; a page's own fetch keeps the rule above.
      behavior: liveRefreshBehavior,
      refetchOnWindowFocus: false, // only /auth/me opts in
      refetchOnReconnect: false, // lib/liveRefresh refreshes the page once when the browser is back online
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (matchQuery({ queryKey: authKeys.me() }, query)) return; // AuthProvider owns /auth/me failures
      refreshAccountOn403(error);
      if (isLiveRefreshFetch(query)) return; // a background round's failure is silent: the next round tries again
      if (query.state.data !== undefined && !isAccountError(error)) toastBus.error(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      refreshAccountOn403(error);
      if (mutation.meta?.silent || isInlineFormError(error) || isAccountError(error)) return;
      toastBus.error(error);
    },
  }),
});
