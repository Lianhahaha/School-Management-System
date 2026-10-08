/**
 * Firebase Admin SDK wrapper.
 *
 * Initialised lazily from the service-account JSON named by
 * FIREBASE_SERVICE_ACCOUNT_PATH (or given base64-encoded in
 * FIREBASE_SERVICE_ACCOUNT_BASE64 on a host that cannot hold the file), so
 * importing this module never needs it (tests replace the methods on the
 * exported object with fakes).
 * `assertFirebaseReady()` is called once at server start to fail early.
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

let adminAuth = null;
let projectId = null;

const source = () =>
  env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? 'FIREBASE_SERVICE_ACCOUNT_BASE64'
    : `Firebase service account file ${env.firebaseServiceAccountPath}`;

function readServiceAccountText() {
  if (env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  }
  try {
    return readFileSync(env.firebaseServiceAccountPath, 'utf8');
  } catch {
    throw new Error(
      `Firebase service account file not found at ${env.firebaseServiceAccountPath}. ` +
        'Download it from Firebase console > Project settings > Service accounts > "Generate new private key" ' +
        'and save it as backend/firebase-service-account.json (or set FIREBASE_SERVICE_ACCOUNT_PATH).',
    );
  }
}

export function loadServiceAccount() {
  const raw = readServiceAccountText();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${source()} is not valid JSON.`);
  }
  for (const field of ['project_id', 'private_key', 'client_email']) {
    if (typeof parsed[field] !== 'string' || !parsed[field]) {
      throw new Error(`${source()} is missing the "${field}" field; download a fresh key.`);
    }
  }
  if (parsed.type !== 'service_account') {
    throw new Error(`${source()} must have "type": "service_account" (this looks like a web config).`);
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
 * How long a token check may take. It runs locally, except when Google's signing keys are downloaded again
 * (about every six hours), which has no time limit of its own; a stall there must not hang every request.
 */
const VERIFY_TIMEOUT_MS = 10_000;

/** `promise`, or a rejection with a plain Error after `ms` (answered as 503 auth by tokenVerificationError). */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
  verifyIdToken: (token) => (
    init(),
    withTimeout(adminAuth.verifyIdToken(token), VERIFY_TIMEOUT_MS, 'Firebase token check timed out')
  ),
  createUser: (properties) => (init(), adminAuth.createUser(properties)),
  getUserByEmail: (emailAddress) => (init(), adminAuth.getUserByEmail(emailAddress)),
  updateUser: (uid, properties) => (init(), adminAuth.updateUser(uid, properties)),
  deleteUser: (uid) => (init(), adminAuth.deleteUser(uid)),
  revokeRefreshTokens: (uid) => (init(), adminAuth.revokeRefreshTokens(uid)),
};
