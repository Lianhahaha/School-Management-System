/**
 * Firebase Admin SDK wrapper.
 *
 * Initialised lazily from the service-account JSON named by
 * FIREBASE_SERVICE_ACCOUNT_PATH, so importing this module never needs the
 * file (tests replace the methods on the exported object with fakes).
 * `assertFirebaseReady()` is called once at server start to fail early.
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

let adminAuth = null;
let projectId = null;

export function loadServiceAccount() {
  let raw;
  try {
    raw = readFileSync(env.firebaseServiceAccountPath, 'utf8');
  } catch {
    throw new Error(
      `Firebase service account file not found at ${env.firebaseServiceAccountPath}. ` +
        'Download it from Firebase console > Project settings > Service accounts > "Generate new private key" ' +
        'and save it as backend/firebase-service-account.json (or set FIREBASE_SERVICE_ACCOUNT_PATH).',
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Firebase service account file ${env.firebaseServiceAccountPath} is not valid JSON.`);
  }
  for (const field of ['project_id', 'private_key', 'client_email']) {
    if (typeof parsed[field] !== 'string' || !parsed[field]) {
      throw new Error(`Firebase service account file is missing the "${field}" field; download a fresh key.`);
    }
  }
  if (parsed.type !== 'service_account') {
    throw new Error(
      'Firebase service account file must have "type": "service_account" (this looks like a web config).',
    );
  }
  return parsed;
}

function init() {
  if (adminAuth) return;
  const serviceAccount = loadServiceAccount();
  const app =
    getApps()[0] ?? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  adminAuth = getAuth(app);
  projectId = serviceAccount.project_id;
}

/** Throws a readable error when the service account is missing or malformed. */
export function assertFirebaseReady() {
  init();
}

/**
 * The Admin SDK surface the application uses. Properties are plain functions
 * so tests can replace them (e.g. `firebase.verifyIdToken = async () => ...`).
 */
export const firebase = {
  get projectId() {
    init();
    return projectId;
  },
  verifyIdToken: (token) => (init(), adminAuth.verifyIdToken(token)),
  createUser: (properties) => (init(), adminAuth.createUser(properties)),
  getUser: (uid) => (init(), adminAuth.getUser(uid)),
  getUserByEmail: (emailAddress) => (init(), adminAuth.getUserByEmail(emailAddress)),
  updateUser: (uid, properties) => (init(), adminAuth.updateUser(uid, properties)),
  deleteUser: (uid) => (init(), adminAuth.deleteUser(uid)),
  revokeRefreshTokens: (uid) => (init(), adminAuth.revokeRefreshTokens(uid)),
};
