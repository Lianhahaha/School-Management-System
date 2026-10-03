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

export const env = Object.freeze({
  firebase: Object.freeze({
    apiKey: read('VITE_FIREBASE_API_KEY'),
    authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: read('VITE_FIREBASE_PROJECT_ID'),
    appId: read('VITE_FIREBASE_APP_ID'),
  }),
  apiBaseUrl: read('VITE_API_BASE_URL') || API_BASE_PATH,
  apiDocsUrl: read('VITE_API_DOCS_URL') || '/api/docs',
});
