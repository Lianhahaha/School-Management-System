/**
 * get-token.js — signs in to Firebase with e-mail and password and prints an ID token, so the API can
 * be called from Swagger UI ("Authorize"), curl or Postman without the frontend.
 *
 *   npm run token --silent -- student1@school.test              password defaults to SEED_PASSWORD
 *   npm run token --silent -- admin@school.test "Other pass1"
 *
 * Only the token goes to stdout (usable as `$(npm run token --silent -- ...)`); messages go to stderr.
 * An ID token expires after one hour; run the command again for a new one.
 * Needs VITE_FIREBASE_API_KEY in frontend/.env.
 */
import { env } from '../src/config/env.js';
import { frontendEnvPath, readFrontendEnv } from './lib/frontendEnv.js';

const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

const REASONS = {
  EMAIL_NOT_FOUND: 'No Firebase account for this e-mail. Run `npm run db:seed` or create the user first.',
  INVALID_PASSWORD: 'Wrong password.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong e-mail or password.',
  USER_DISABLED: 'This account is disabled in Firebase.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  API_KEY_INVALID: 'VITE_FIREBASE_API_KEY in frontend/.env is not a valid Firebase web API key.',
  OPERATION_NOT_ALLOWED:
    'E-mail/password sign-in is not enabled: Firebase console > Authentication > Sign-in method.',
};

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const [email, password = env.SEED_PASSWORD] = process.argv.slice(2);
if (!email) fail('Usage: npm run token --silent -- <email> [password]');

const frontendEnv = readFrontendEnv();
if (!frontendEnv)
  fail(`${frontendEnvPath} not found. Copy frontend/.env.example and fill in the Firebase web config.`);
const apiKey = frontendEnv.VITE_FIREBASE_API_KEY;
if (!apiKey) fail('VITE_FIREBASE_API_KEY is empty in frontend/.env.');

let response;
try {
  response = await fetch(`${SIGN_IN_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
} catch (error) {
  fail(`Could not reach Firebase (${error.cause?.code ?? error.message}). Check the internet connection.`);
}

const body = await response.json();
if (!response.ok) {
  const code = String(body.error?.message ?? '').split(' ')[0];
  fail(REASONS[code] ?? `Firebase refused the sign-in: ${body.error?.message ?? response.status}`);
}

console.error(
  `✔ Signed in as ${body.email}. Token valid for ${Math.round(Number(body.expiresIn) / 60)} minutes.`,
);
console.log(body.idToken);
