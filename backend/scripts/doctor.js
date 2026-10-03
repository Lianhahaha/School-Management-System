/**
 * doctor.js — checks the local setup and says exactly what to fix. Run `npm run doctor` when
 * something does not start; it never changes anything.
 *
 * Checks: Node version, backend/.env, MySQL (reachable, version, database, tables), Firebase service
 * account (valid, accepted by Firebase), frontend/.env (same project as the service account), API port.
 */
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { firebase, loadServiceAccount } from '../src/config/firebase.js';
import { frontendEnvPath, readFrontendEnv } from './lib/frontendEnv.js';

const REQUIRED_NODE = [22, 22];
const REQUIRED_MYSQL = [8, 0, 19];
const EXPECTED_TABLES = 12;

const results = [];
const record = (level, name, detail = '') => {
  results.push(level);
  const icon = { ok: '✔', warn: '!', fail: '✖' }[level];
  console.log(`${icon} ${name}${detail ? `: ${detail}` : ''}`);
};
const atLeast = (actual, required) => {
  for (const [index, minimum] of required.entries()) {
    if ((actual[index] ?? 0) !== minimum) return (actual[index] ?? 0) > minimum;
  }
  return true;
};

function checkNode() {
  const version = process.versions.node.split('.').map(Number);
  const label = `Node ${process.versions.node}`;
  if (atLeast(version, REQUIRED_NODE)) record('ok', label);
  else record('fail', label, `need >= ${REQUIRED_NODE.join('.')} (install Node 24 LTS, see .nvmrc)`);
}

function checkEnvFile() {
  const file = path.join(env.backendRoot, '.env');
  if (existsSync(file)) record('ok', 'backend/.env found');
  else record('warn', 'backend/.env missing', 'defaults are used; copy .env.example to .env to change them');
}

async function checkDatabase() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectTimeout: 5000,
    });
  } catch (error) {
    const hint =
      error.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'wrong DB_USER / DB_PASSWORD in backend/.env'
        : `is the "MySQL80" service running on ${env.DB_HOST}:${env.DB_PORT}?`;
    return record('fail', 'MySQL connection', `${error.code ?? error.message} (${hint})`);
  }
  try {
    const [[{ version }]] = await conn.query('SELECT VERSION() AS version');
    const parsed = version.split('-')[0].split('.').map(Number);
    if (atLeast(parsed, REQUIRED_MYSQL)) record('ok', `MySQL ${version}`);
    else record('fail', `MySQL ${version}`, `need >= ${REQUIRED_MYSQL.join('.')} (upserts use row aliases)`);

    const [databases] = await conn.query('SHOW DATABASES LIKE ?', [env.DB_NAME]);
    if (!databases.length) {
      return record('fail', `database ${env.DB_NAME}`, 'missing; run `npm run db:migrate`');
    }
    const [tables] = await conn.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
      [env.DB_NAME],
    );
    if (tables[0].total >= EXPECTED_TABLES)
      record('ok', `database ${env.DB_NAME}`, `${tables[0].total} tables`);
    else
      record(
        'fail',
        `database ${env.DB_NAME}`,
        `${tables[0].total} tables, expected ${EXPECTED_TABLES}; run \`npm run db:migrate\``,
      );
  } finally {
    await conn.end();
  }
}

/** Returns the service account's project id, or null when it is unusable. */
async function checkServiceAccount() {
  let projectId;
  try {
    projectId = loadServiceAccount().project_id;
  } catch (error) {
    record('fail', 'Firebase service account', error.message);
    return null;
  }
  record('ok', 'Firebase service account', `project ${projectId}`);
  try {
    await firebase.getUserByEmail('doctor-check@invalid.test');
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      record('fail', 'Firebase Admin call', `${error.code ?? ''} ${error.message}`.trim());
      return projectId;
    }
  }
  record('ok', 'Firebase Admin call', 'the key is accepted by Firebase');
  return projectId;
}

function checkFrontendEnv(projectId) {
  const frontendEnv = readFrontendEnv();
  if (!frontendEnv) {
    return record('fail', 'frontend/.env', `missing (${frontendEnvPath}); copy frontend/.env.example`);
  }
  const missing = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ].filter((key) => !frontendEnv[key]);
  if (missing.length) return record('fail', 'frontend/.env', `empty: ${missing.join(', ')}`);
  if (projectId && frontendEnv.VITE_FIREBASE_PROJECT_ID !== projectId) {
    return record(
      'fail',
      'frontend/.env project',
      `VITE_FIREBASE_PROJECT_ID is "${frontendEnv.VITE_FIREBASE_PROJECT_ID}" but the service account belongs to "${projectId}"; every API call would fail with a token audience error`,
    );
  }
  record('ok', 'frontend/.env', 'complete and on the same Firebase project');
}

function checkPort() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', (error) => {
      const detail = error.code === 'EADDRINUSE' ? 'in use (the API may already be running)' : error.message;
      record('warn', `port ${env.PORT}`, detail);
      resolve();
    });
    probe.listen(env.PORT, '127.0.0.1', () => {
      probe.close(() => {
        record('ok', `port ${env.PORT} free`);
        resolve();
      });
    });
  });
}

checkNode();
checkEnvFile();
await checkDatabase();
const projectId = await checkServiceAccount();
checkFrontendEnv(projectId);
await checkPort();

const failures = results.filter((level) => level === 'fail').length;
console.log(failures ? `\n✖ ${failures} problem(s) to fix.` : '\n✔ Setup looks good.');
process.exit(failures ? 1 : 0);
