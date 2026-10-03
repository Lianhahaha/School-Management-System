/**
 * The one QueryClient, with the app-wide error policy:
 *
 *   queries    first-load failures render an inline ErrorState in the page; a failed background
 *              refetch (data already on screen) raises a toast.
 *   mutations  raise a toast, except errors a form renders next to its fields (isInlineFormError)
 *              and mutations that opt out with `meta: { silent: true }` because their form shows
 *              every error itself (sign-in, registration, profile).
 *
 * A 403 may mean the account changed (disabled, removed): /auth/me is re-fetched so that
 * AuthProvider can sign the user out with a message. Those account codes never toast.
 */
import { MutationCache, QueryCache, QueryClient, matchQuery } from '@tanstack/react-query';
import { FORCE_SIGN_OUT_CODES } from '../constants/ui';
import { authKeys } from '../features/auth/keys';
import { isInlineFormError } from './formErrors';
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
      retry: (failureCount, error) => Boolean(error?.isTransient) && failureCount < MAX_RETRIES,
      refetchOnWindowFocus: false, // only /auth/me opts in
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (matchQuery({ queryKey: authKeys.me() }, query)) return; // AuthProvider owns /auth/me failures
      refreshAccountOn403(error);
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
