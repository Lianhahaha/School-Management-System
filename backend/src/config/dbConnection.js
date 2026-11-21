/**
 * Connection settings shared by the API pool and every script that opens its own connection
 * (migrate, doctor, backup, restore, tests), so a hosted MySQL that requires TLS works the same everywhere.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

function readCa() {
  if (env.DB_SSL_CA) return env.DB_SSL_CA.replaceAll('\\n', '\n');
  if (env.DB_SSL_CA_PATH) return readFileSync(path.resolve(env.backendRoot, env.DB_SSL_CA_PATH), 'utf8');
  return undefined;
}

/** A database on this machine is started as a Windows service; a hosted one is switched on by its provider. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const START_LOCAL_MYSQL =
  'Start the "MySQL80" service (services.msc, or `net start MySQL80` in an administrator terminal).';
const START_HOSTED_MYSQL =
  "Check the service in the provider's console (a free Aiven service is powered off after long inactivity) and that DB_HOST / DB_PORT are right.";

/**
 * What to do about a MySQL error, by driver code; printed by the server at start-up and by the scripts.
 * `host` is a parameter so the hint can be tested, and defaults to DB_HOST.
 */
export function dbErrorHint(error, host = env.DB_HOST) {
  const startHint = LOCAL_HOSTS.has(host) ? START_LOCAL_MYSQL : START_HOSTED_MYSQL;
  switch (error?.code) {
    case 'ECONNREFUSED':
      return `MySQL is not reachable at ${host}:${env.DB_PORT}. ${startHint}`;
    case 'ETIMEDOUT':
      return `The connection to ${host}:${env.DB_PORT} timed out. ${startHint}`;
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Wrong DB_USER / DB_PASSWORD in backend/.env (wrap the password in double quotes if it contains # or spaces).';
    case 'ER_DBACCESS_DENIED_ERROR':
      return `DB_USER has no privileges on the database ${env.DB_NAME}. Grant them or use the root account.`;
    case 'ER_BAD_DB_ERROR':
      return 'The database does not exist yet: run `npm run db:migrate`.';
    case 'ER_NO_SUCH_TABLE':
      return 'A table is missing: run `npm run db:migrate`.';
    default:
      return undefined;
  }
}

export function dbConnectionOptions() {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ...(env.DB_SSL && { ssl: { ca: readCa(), rejectUnauthorized: true, minVersion: 'TLSv1.2' } }),
  };
}
