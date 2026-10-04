import { useMutation } from '@tanstack/react-query';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { auth } from '../../config/firebase';
import { useToast } from '../../hooks/useToast';
import { AuthContext } from './authContext';
import { register, updateMe } from './api';
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
    mutationFn: ({ email, password }) => signInWithEmailAndPassword(auth, email, password),
    meta: { silent: true },
  });
}

/**
 * Student self-registration followed by an automatic sign-in. Rejects with an ApiError from the
 * registration call (map it with applyServerErrors). If only the sign-in fails, the account exists,
 * so the user is sent to /login with a notice instead. Silent: the form renders the error itself.
 */
export function useRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setAuthNotice } = useAuth();

  return useMutation({
    mutationFn: async (body) => {
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
      if (isSignedIn) {
        toast.success(`Welcome, ${body.firstName}!`);
        return;
      }
      setAuthNotice({ tone: 'success', message: 'Account created. Please sign in.' });
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      if (error.details?.reason === REGISTRATION_DISABLED) markRegistrationClosed();
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
    mutationFn: async (email) => {
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
