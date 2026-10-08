/**
 * Connection settings shared by the API pool and every script that opens its own connection
 * (migrate, seed, doctor, tests), so a hosted MySQL that requires TLS works the same everywhere.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

function readCa() {
  if (env.DB_SSL_CA) return env.DB_SSL_CA.replaceAll('\\n', '\n');
  if (env.DB_SSL_CA_PATH) return readFileSync(path.resolve(env.backendRoot, env.DB_SSL_CA_PATH), 'utf8');
  return undefined;
}

/** What to do about a MySQL error, by driver code; printed by the server at start-up and by the scripts. */
const DB_ERROR_HINTS = {
  ECONNREFUSED: `MySQL is not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start the "MySQL80" service (services.msc, or \`net start MySQL80\` in an administrator terminal).`,
  ETIMEDOUT: `The connection to ${env.DB_HOST}:${env.DB_PORT} timed out. Check DB_HOST / DB_PORT and that MySQL is running.`,
  ER_ACCESS_DENIED_ERROR:
    'Wrong DB_USER / DB_PASSWORD in backend/.env (wrap the password in double quotes if it contains # or spaces).',
  ER_DBACCESS_DENIED_ERROR: `DB_USER has no privileges on the database ${env.DB_NAME}. Grant them or use the root account.`,
  ER_BAD_DB_ERROR: 'The database does not exist yet: run `npm run db:migrate`.',
  ER_NO_SUCH_TABLE: 'A table is missing: run `npm run db:migrate`.',
};

/** The hint for a MySQL error, or undefined when there is none. */
export const dbErrorHint = (error) => DB_ERROR_HINTS[error?.code];

export function dbConnectionOptions() {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ...(env.DB_SSL && { ssl: { ca: readCa(), rejectUnauthorized: true, minVersion: 'TLSv1.2' } }),
  };
}
