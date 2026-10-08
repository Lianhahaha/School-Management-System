/**
 * Translates Firebase Admin SDK errors (`code` starts with "auth/" or "app/") into ApiError.
 * Every mapped error keeps the Firebase error as its `cause` for the logs.
 */
import { ApiError } from './ApiError.js';

const TOKEN_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
]);

/** Firebase could not be reached or refused for now: a retry may succeed, so 503, not 500. */
const TRANSIENT_CODES = new Set([
  'app/network-error',
  'app/network-timeout',
  'app/internal-error',
  'auth/internal-error',
  'auth/quota-exceeded',
]);

/**
 * firebase-admin reports a failed download of Google's token-signing keys (network down, certificate
 * endpoint unreachable) as `auth/argument-error`, the code of a malformed token; only the message differs.
 */
const KEY_FETCH_FAILURE = /^Error (fetching public keys|while making request)/;

const hasCodePrefix = (error, prefixes) =>
  Boolean(
    error && typeof error.code === 'string' && prefixes.some((prefix) => error.code.startsWith(prefix)),
  );

export const isFirebaseError = (error) => hasCodePrefix(error, ['auth/', 'app/']);

export function firebaseErrorMap(error) {
  const options = { cause: error };
  switch (error.code) {
    case 'auth/email-already-exists':
      return ApiError.conflict('email already registered', { key: 'users.uq_users_email' }, options);
    case 'auth/invalid-email':
    case 'auth/invalid-password':
      return ApiError.validation(error.message, undefined, { reason: error.code }, options);
    case 'auth/user-not-found':
      // Reaching this means a users row exists without its Firebase account: data drift that must be loud.
      return ApiError.internal('firebase user missing for a registered account', options);
    default:
      if (TOKEN_CODES.has(error.code)) {
        return ApiError.unauthorized('invalid or expired token', error.code, options);
      }
      if (TRANSIENT_CODES.has(error.code)) return ApiError.unavailable('auth', options);
      return ApiError.internal(undefined, options);
  }
}

/**
 * Failure of `verifyIdToken`: 401 when the token itself is bad, 503 when it could not be checked at all,
 * so clients keep the session and retry instead of signing the user out.
 */
export function tokenVerificationError(error) {
  if (!hasCodePrefix(error, ['auth/']) || KEY_FETCH_FAILURE.test(error.message)) {
    return ApiError.unavailable('auth', { cause: error });
  }
  return firebaseErrorMap(error);
}
