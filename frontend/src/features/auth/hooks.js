import { useMutation, useQuery } from '@tanstack/react-query';
import { sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { auth } from '../../config/firebase';
import { useToast } from '../../hooks/useToast';
import { AuthContext } from './authContext';
import { createDemoToken, getDemo, register, updateMe } from './api';
import { authKeys } from './keys';
import { REGISTRATION_DISABLED, markRegistrationClosed } from './registrationClosed';

/** The signed-in session; see authContext.js for the fields. Throws outside <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth outside AuthProvider');
  return context;
}

/**
 * Email and password sign-in. Nothing else happens here: AuthProvider notices the new Firebase
 * user, loads /auth/me and the guards redirect. A failure is a Firebase error; show it with
 * mapFirebaseError(error.code). Silent: the form renders the error itself.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (/** @type {{ email: string, password: string }} */ { email, password }) =>
      signInWithEmailAndPassword(auth, email, password),
    meta: { silent: true },
  });
}

/**
 * The demo account the sign-in page offers (`{ firstName, lastName, role }`), or null when the API offers none
 * (404 `demo_disabled`). Any other failure leaves `data` undefined, so the page simply shows no demo.
 */
export function useDemoAccount() {
  return useQuery({
    queryKey: authKeys.demo(),
    queryFn: () => getDemo().catch((error) => (error?.status === 404 ? null : Promise.reject(error))),
    staleTime: 5 * 60_000,
  });
}

/**
 * One-tap sign-in as the demo account: a custom token from the API, then the Firebase sign-in with it. As with
 * useLogin, AuthProvider takes over from there. Silent: the demo tile shows the error itself.
 */
export function useDemoSignIn() {
  return useMutation({
    mutationFn: async () => {
      const { customToken } = await createDemoToken();
      return signInWithCustomToken(auth, customToken);
    },
    meta: { silent: true },
  });
}

/**
 * Self-registration (a student, or a student assistant: `accountType`) followed by an automatic sign-in;
 * the guards then open the student's dashboard, where they pick a class, or the assistant's waiting screen.
 * Rejects with an ApiError from the registration call (map it with applyServerErrors). If only the sign-in
 * fails, the account exists, so the user is sent to /login with a notice instead. Silent: the form renders
 * the error itself.
 */
export function useRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setAuthNotice } = useAuth();

  return useMutation({
    mutationFn: async (
      /** @type {{ accountType: 'student' | 'assistant', firstName: string, email: string, password: string }} */ body,
    ) => {
      await register(body);
      try {
        await signInWithEmailAndPassword(auth, body.email, body.password);
        return { isSignedIn: true };
      } catch (error) {
        console.error('Sign-in after registration failed:', error.code);
        return { isSignedIn: false };
      }
    },
    onSuccess: ({ isSignedIn }, body) => {
      const isAssistant = body.accountType === 'assistant';
      if (isSignedIn) {
        toast.success(isAssistant ? 'Request sent' : `Welcome, ${body.firstName}!`);
        return;
      }
      setAuthNotice({
        tone: 'success',
        message: isAssistant
          ? 'Request sent. Sign in to see where it stands.'
          : 'Account created. Please sign in.',
      });
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      // Only register() can reject (a failed sign-in is caught above), and it rejects with an ApiError.
      const { details } = /** @type {import('../../lib/apiClient').ApiError} */ (error);
      if (details?.reason === REGISTRATION_DISABLED) markRegistrationClosed();
    },
    meta: { silent: true },
  });
}

/**
 * Sends the Firebase password-reset email. `auth/user-not-found` counts as success so the form
 * never reveals which emails are registered. Silent: the form renders the error itself.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (/** @type {string} */ email) => {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
      }
    },
    meta: { silent: true },
  });
}

/**
 * PATCH /auth/me. Resolves with the updated account and refreshes the session's `me`.
 * Silent: the contact form renders the error itself.
 */
export function useUpdateMe() {
  const toast = useToast();
  const { refreshMe } = useAuth();

  return useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      refreshMe();
      toast.success('Profile updated');
    },
    meta: { silent: true },
  });
}
