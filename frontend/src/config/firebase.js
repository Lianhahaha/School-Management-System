/**
 * Firebase client. Only Authentication is used (email and password), so the app initialises it with the
 * same persistence getAuth would use (users stay signed in across tabs and browser restarts) but without the
 * popup and redirect sign-in code getAuth bundles.
 */
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { env } from './env';

const app = initializeApp({
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
});

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
