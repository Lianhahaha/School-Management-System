import { createContext } from 'react';

/**
 * What AuthProvider shares (read it through `useAuth()`):
 *   status      'initializing' | 'anonymous' | 'resolving' | 'authenticated' | 'profile-error'
 *   firebaseUser the Firebase user, used for the ID token only; never render its fields
 *   me          the GET /auth/me account when status is 'authenticated', else null
 *   role        me.role, or null
 *   authNotice  { tone, message } shown on the sign-in page after a forced sign-out, or null
 *   setAuthNotice(notice | null)
 *   logout()    signs out; the guards redirect to /login
 *   refreshMe() re-fetches /auth/me (after a profile change or an unexpected 403, or to retry)
 */
export const AuthContext = createContext(null);
