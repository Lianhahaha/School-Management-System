/**
 * Runtime configuration, read once from `import.meta.env` and validated at start-up.
 *
 * Only variables prefixed with VITE_ reach the browser, they come from `frontend/.env`
 * and are inlined at build time. A typo is silently `undefined` in Vite, so this module
 * fails loudly instead: main.jsx shows the error message as a plain full-page notice.
 */
import { API_BASE_PATH } from '../constants/shared';

const REQUIRED_FIREBASE_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

/** Values copied from .env.example start with "your-" and have not been filled in yet. */
const isPlaceholder = (value) => value.startsWith('your-');

function read(name) {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

const missing = REQUIRED_FIREBASE_VARS.filter((name) => read(name) === '' || isPlaceholder(read(name)));

if (missing.length > 0) {
  throw new Error(
    `Missing or unfilled environment variable(s): ${missing.join(', ')}. ` +
      'Copy frontend/.env.example to frontend/.env, fill in the Firebase web app values, ' +
      'and restart the dev server (npm run dev).',
  );
}

/**
 * Demo sign-ins listed on the sign-in page (features/auth/components/DemoAccounts), from VITE_DEMO_ACCOUNTS:
 * `{"password":"…","accounts":[{"role":"Admin","email":"…"},…]}`. Optional: unset, the page lists nothing. They
 * come from the build, not the code, so no password sits in the repository and a release without the variable
 * removes the list. A malformed value is reported in the console and ignored, so it never takes the site down.
 * @returns {Readonly<{ password: string, accounts: ReadonlyArray<{ role: string, email: string }> }> | null}
 */
function readDemoAccounts() {
  const raw = read('VITE_DEMO_ACCOUNTS');
  if (raw === '') return null;
  try {
    const { password, accounts } = JSON.parse(raw);
    const isAccount = (account) => typeof account?.role === 'string' && typeof account?.email === 'string';
    if (typeof password !== 'string' || !Array.isArray(accounts) || !accounts.every(isAccount)) {
      throw new Error('expected {"password": string, "accounts": [{"role": string, "email": string}]}');
    }
    return Object.freeze({
      password,
      accounts: Object.freeze(accounts.map((account) => Object.freeze({ ...account }))),
    });
  } catch (error) {
    console.error(`VITE_DEMO_ACCOUNTS is ignored: ${error.message}`);
    return null;
  }
}

export const env = Object.freeze({
  firebase: Object.freeze({
    apiKey: read('VITE_FIREBASE_API_KEY'),
    authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: read('VITE_FIREBASE_PROJECT_ID'),
    appId: read('VITE_FIREBASE_APP_ID'),
  }),
  apiBaseUrl: read('VITE_API_BASE_URL') || API_BASE_PATH,
  demoAccounts: readDemoAccounts(),
});
