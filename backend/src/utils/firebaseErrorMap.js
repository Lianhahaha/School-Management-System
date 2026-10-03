/**
 * Translates Firebase Admin SDK errors (`code` starts with "auth/") into ApiError.
 */
import { ApiError } from './ApiError.js';

const TOKEN_CODES = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/session-cookie-expired',
]);

export function isFirebaseError(error) {
  return Boolean(error && typeof error.code === 'string' && error.code.startsWith('auth/'));
}

export function firebaseErrorMap(error) {
  switch (error.code) {
    case 'auth/email-already-exists':
      return ApiError.conflict('email already registered', { key: 'users.uq_users_email' });
    case 'auth/invalid-email':
    case 'auth/invalid-password':
    case 'auth/invalid-phone-number':
      return ApiError.validation(error.message, undefined, { reason: error.code });
    case 'auth/user-not-found':
      // Reaching this means a users row exists without its Firebase account: data drift that must be loud.
      return ApiError.internal('firebase user missing for a registered account');
    default:
      if (TOKEN_CODES.has(error.code)) return ApiError.unauthorized('invalid or expired token', error.code);
      return ApiError.internal();
  }
}
