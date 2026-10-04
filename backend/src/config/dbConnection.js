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

export function dbConnectionOptions() {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ...(env.DB_SSL && { ssl: { ca: readCa(), rejectUnauthorized: true, minVersion: 'TLSv1.2' } }),
  };
}
