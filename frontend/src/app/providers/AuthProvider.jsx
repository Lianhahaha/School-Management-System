import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { ERROR_CODES } from '../../constants/shared';
import { SESSION_EXPIRED_MESSAGE, SIGN_OUT_MESSAGES } from '../../constants/ui';
import { getMe } from '../../features/auth/api';
import { AuthContext } from '../../features/auth/authContext';
import { authKeys } from '../../features/auth/keys';
import { ApiError } from '../../lib/apiClient';
import { toastBus } from '../../lib/toastBus';

/** Only an ApiError that a retry will not fix ends the session; anything unexpected gets the retry screen. */
const isSessionError = (error) => error instanceof ApiError && !error.isTransient;

async function loadMe(onSessionError) {
  try {
    const me = await getMe();
    if (!me.isActive) {
      throw new ApiError({
        status: 403,
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: SIGN_OUT_MESSAGES[ERROR_CODES.ACCOUNT_DISABLED],
      });
    }
    return me;
  } catch (error) {
    if (isSessionError(error)) onSessionError(error);
    throw error;
  }
}

function deriveStatus({ isReady, firebaseUser }, meQuery) {
  if (!isReady) return 'initializing';
  if (!firebaseUser) return 'anonymous';
  if (meQuery.isError && isSessionError(meQuery.error)) return 'resolving';
  if (meQuery.data) return 'authenticated';
  return meQuery.isError ? 'profile-error' : 'resolving';
}

/**
 * The only place where Firebase identity and the backend account meet.
 *
 *   initializing    waiting for Firebase to report the persisted user (no login flash on reload)
 *   anonymous       nobody is signed in
 *   resolving       signed in, loading GET /auth/me (also while a forced sign-out is in progress)
 *   authenticated   `me` is available; this is the only status in which data queries run
 *   profile-error   /auth/me failed because the server is unreachable or broken: retry, no sign-out
 *
 * Any other /auth/me failure (account not registered, disabled, expired session) signs the user
 * out and leaves a notice for the sign-in page. The query cache is cleared on every sign-out, so
 * the next user never sees the previous user's rows.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState({ isReady: false, firebaseUser: null });
  const [authNotice, setAuthNotice] = useState(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) setAuthNotice(null);
        else queryClient.clear();
        setSession({ isReady: true, firebaseUser });
      }),
    [queryClient],
  );

  const forceSignOut = (error) => {
    setAuthNotice({ tone: 'error', message: SIGN_OUT_MESSAGES[error.code] ?? SESSION_EXPIRED_MESSAGE });
    return signOut(auth);
  };

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: () => loadMe(forceSignOut),
    enabled: session.firebaseUser !== null,
    // A network blip or 5xx is retried once before the retry screen; a 4xx (a session answer) never is.
    retry: (failureCount, error) => Boolean(error?.isTransient) && failureCount < 1,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true, // picks up a deactivation or profile change made by an administrator
    // A student's class lives in this session (currentEnrollment): refresh it now and then, so an
    // enrollment or transfer made by an administrator shows without a reload. A failed background
    // refresh keeps the current session (status stays 'authenticated' while data is present).
    refetchInterval: (query) => (query.state.data?.role === 'student' ? 60_000 : false),
  });

  const status = deriveStatus(session, meQuery);
  const me = status === 'authenticated' ? meQuery.data : null;

  const value = {
    status,
    firebaseUser: session.firebaseUser,
    me,
    role: me?.role ?? null,
    authNotice,
    setAuthNotice,
    logout: () => signOut(auth).then(() => toastBus.info('Signed out')),
    refreshMe: () => queryClient.invalidateQueries({ queryKey: authKeys.me() }),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
