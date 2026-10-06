/**
 * Firebase Authentication error code -> message for the user. Credential problems share one
 * message on purpose, so the form never reveals whether an email is registered.
 */
const CREDENTIALS_MESSAGE = 'Incorrect email or password.';

const MESSAGES = {
  'auth/invalid-credential': CREDENTIALS_MESSAGE,
  'auth/wrong-password': CREDENTIALS_MESSAGE,
  'auth/user-not-found': CREDENTIALS_MESSAGE,
  'auth/invalid-email': CREDENTIALS_MESSAGE,
  'auth/too-many-requests': 'Too many attempts. Try again later or reset your password.',
  'auth/user-disabled': 'This account has been deactivated. Contact the administrator.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  // A setup problem, so say so instead of hiding it behind a generic message.
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this Firebase project.',
};

/**
 * @param {string} code Firebase error code, for example 'auth/invalid-credential'
 * @param {string} [fallback] message for codes that are not listed (the code is logged)
 */
export function mapFirebaseError(code, fallback = 'Sign-in failed. Please try again.') {
  if (Object.hasOwn(MESSAGES, code)) return MESSAGES[code];
  console.error('Unmapped Firebase auth error:', code);
  return fallback;
}
