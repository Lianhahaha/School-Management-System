/**
 * Firebase client. Only Authentication is used (email and password); the default
 * persistence keeps users signed in across tabs and browser restarts.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { env } from './env';

const app = initializeApp({
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
});

export const auth = getAuth(app);
