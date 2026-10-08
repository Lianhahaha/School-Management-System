/**
 * Environment configuration — the only module that reads process.env.
 *
 * Values come from backend/.env (loaded by Node's --env-file-if-exists flag in
 * the npm scripts) or from the real environment. Everything is validated with
 * zod at import time; an invalid or missing value stops the process with a
 * readable list instead of failing later with a confusing database or
 * Firebase error.
 */
import path from 'node:path';
import { z } from 'zod';

const backendRoot = path.resolve(import.meta.dirname, '..', '..');

const boolString = z.enum(['true', 'false']).transform((value) => value === 'true');

const machineTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
/** Any zone the runtime can format in. Intl.supportedValuesOf lists canonical ids only and misses aliases such as Asia/Kolkata. */
const isSupportedTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DOCS_ENABLED: boolString.default(true),
  ALLOW_PUBLIC_REGISTRATION: boolString.default(true),
  APP_TIMEZONE: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || machineTimeZone())
    .refine(isSupportedTimeZone, {
      error: 'must be a valid IANA time zone such as Asia/Manila or Europe/Berlin',
    }),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/, { error: 'letters, digits and underscores only' })
    // The timetable lock is named "<DB_NAME>:timetable" and MySQL lock names stop at 64 characters.
    .max(54, { error: 'at most 54 characters' })
    .default('school_management'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  // A hosted MySQL requires an encrypted connection: DB_SSL=true, plus the provider's CA certificate
  // as a file (DB_SSL_CA_PATH) or as PEM text with a literal backslash-n for line breaks (DB_SSL_CA).
  DB_SSL: boolString.default(false),
  DB_SSL_CA_PATH: z.string().min(1).optional(),
  DB_SSL_CA: z.string().min(1).optional(),

  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1).default('./firebase-service-account.json'),
  // For a host without a file system for secrets: the same JSON, base64-encoded (takes precedence over the file).
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().min(1).optional(),

  SEED_PASSWORD: z.string().min(8).default('Password123!'),
});

// An empty value in .env (e.g. `APP_TIMEZONE=`) means "not set", not an empty string.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  console.error(
    `✖ Invalid environment configuration (backend/.env):\n${lines.join('\n')}\n  See backend/.env.example for every variable.`,
  );
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  // A local database usually shares its Firebase project with the live site (README, Deploying): a
  // Firebase user it does not know may be a live user, so only production and the tests replace one.
  replacesUnlinkedFirebaseUsers: parsed.data.NODE_ENV !== 'development',
  backendRoot,
  firebaseServiceAccountPath: path.resolve(backendRoot, parsed.data.FIREBASE_SERVICE_ACCOUNT_PATH),
});
