/**
 * Reads frontend/.env for the developer scripts (doctor, token): the Firebase web config lives
 * there, and it must belong to the same Firebase project as the backend service account.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { env } from '../../src/config/env.js';

export const frontendEnvPath = path.resolve(env.backendRoot, '..', 'frontend', '.env');

/** Parsed frontend/.env, or null when the file does not exist. */
export function readFrontendEnv() {
  try {
    return parseEnv(readFileSync(frontendEnvPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
