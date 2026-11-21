/**
 * check-live.js — a read-only check of the deployed system: the site, the API and its database, the
 * migrations, the Firebase accounts and the school's data. It writes nothing, anywhere.
 *
 *   node --env-file=.env --env-file=<hosted env file> scripts/check-live.js [--api <url>] [--site <url>]
 *
 * The database checks refuse a DB_HOST on this machine: they are for the hosted database named by the hosted
 * env file (README, "Deploying for free"). The API and the site default to the live ones, so the same command
 * with a local database would check two different systems at once.
 *
 * It answers the question the uptime check cannot: "is the deployed system, as a whole, in the state this
 * repository expects?" A failed release, a database left behind the code, a sign-up that never reached MySQL,
 * or students nobody placed all show up here.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { UPGRADES } from '../database/upgrades.js';
import { closePool, query } from '../src/config/db.js';
import { isLocalDbHost } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { loadServiceAccount } from '../src/config/firebase.js';
import { currentAcademicYear } from '../src/utils/dates.js';

const DEFAULT_API = 'https://skole-api.onrender.com/api/v1';
const DEFAULT_SITE = 'https://skoleph.web.app';
/** A waking Render service can take a minute; a hosted database may take a few seconds to answer. */
const TIMEOUT_MS = 90_000;

const EXPECTED_TABLES = [
  ...readFileSync(path.join(env.backendRoot, 'database', 'schema.sql'), 'utf8').matchAll(
    /CREATE TABLE IF NOT EXISTS (\w+)/g,
  ),
].map((match) => match[1]);

const flag = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const results = [];
const record = (level, name, detail = '') => {
  results.push(level);
  const icon = { ok: '✔', warn: '!', fail: '✖' }[level];
  console.log(`${icon} ${name}${detail ? `: ${detail}` : ''}`);
};

/** GET a URL with a deadline; returns the response and, for JSON, the parsed body (null when it is not JSON). */
async function get(url, asJson = false, timeoutMs = TIMEOUT_MS, tries = 2) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return { response, body: asJson ? await response.json().catch(() => null) : await response.text() };
    } catch (error) {
      if (attempt === tries) throw error;
      await sleep(2000 * attempt);
    }
  }
}

async function checkSite(url) {
  try {
    const started = performance.now();
    const { response, body } = await get(url, false, 20_000);
    const ms = Math.round(performance.now() - started);
    if (!response.ok) return record('fail', 'site', `${response.status} from ${url}`);
    if (!body.includes('id="root"')) return record('fail', 'site', `${url} answered, but not with the app`);
    record('ok', 'site', `${url} (${response.status}, ${ms} ms)`);
  } catch (error) {
    record('fail', 'site', `${url} did not answer (${error.message})`);
  }
}

async function checkApi(url) {
  try {
    const started = performance.now();
    const { response, body } = await get(`${url.replace(/\/$/, '')}/health`, true);
    const ms = Math.round(performance.now() - started);
    if (!response.ok) return record('fail', 'API', `${response.status} from ${url}`);
    const health = body?.data;
    if (health?.status !== 'ok' || health?.db !== 'up') {
      return record('fail', 'API', `reported ${JSON.stringify(health)}`);
    }
    record(
      'ok',
      'API',
      `${url} (${ms} ms, version ${health.version}, awake ${Math.floor(health.uptimeSeconds / 86400)} d)`,
    );
    if (ms > 5000)
      record('warn', 'API latency', `${ms} ms for /health; a free Render service is slow to answer`);
  } catch (error) {
    record('fail', 'API', `${url} did not answer (${error.message})`);
  }
}

/** Failures a cold free database or a lost connection produces; a second try usually answers. */
const TRANSIENT = new Set(['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The first connection to a free hosted MySQL can take longer than the pool's 10-second connect timeout and be
 * accepted on a second try (seen with Aiven). A diagnostic must not report that as a database that is down.
 */
async function withRetry(operation, tries = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === tries || !TRANSIENT.has(error.code)) throw error;
      await sleep(2000 * attempt);
    }
  }
}

/** query(), retried while the failure is the connection rather than the query. */
const checkedQuery = (sql, params) => withRetry(() => query(sql, params));

async function checkDatabase() {
  if (isLocalDbHost()) {
    return record(
      'fail',
      'database',
      `DB_HOST is ${env.DB_HOST}, this machine. Run with the hosted env file (README, "Deploying for free").`,
    );
  }
  let version;
  let present;
  try {
    const [server] = await checkedQuery('SELECT VERSION() AS version');
    version = server.version;
    const tables = await checkedQuery(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    present = new Set(tables.map((table) => table.name));
  } catch (error) {
    return record('fail', 'database', `${error.code ?? error.message}; the API would answer 503`);
  }
  record('ok', 'database', `${env.DB_NAME} on ${env.DB_HOST}: MySQL ${version}, ${present.size} tables`);

  const missing = EXPECTED_TABLES.filter((name) => !present.has(name));
  if (missing.length) record('fail', 'tables', `missing ${missing.join(', ')}; run the hosted db:migrate`);

  const applied = await checkedQuery('SELECT id, checksum FROM schema_migrations');
  const ids = new Set(applied.map((row) => row.id));
  const pending = UPGRADES.filter((upgrade) => !ids.has(upgrade.id)).map((upgrade) => upgrade.id);
  if (pending.length) {
    record(
      'fail',
      'migrations',
      `not applied: ${pending.join(', ')}; back up, then run the hosted db:migrate`,
    );
  } else {
    record('ok', 'migrations', `all ${UPGRADES.length} upgrades applied`);
  }
  const schemaChecksum = applied.find((row) => row.id === 'schema.sql')?.checksum;
  const fileChecksum = createHash('sha256')
    .update(readFileSync(path.join(env.backendRoot, 'database', 'schema.sql'), 'utf8'))
    .digest('hex');
  if (!schemaChecksum)
    record('warn', 'schema.sql', 'no checksum recorded; was the database created by hand?');
  else if (schemaChecksum !== fileChecksum) {
    record(
      'warn',
      'schema.sql',
      'changed since the database was migrated; run the hosted db:migrate after a backup',
    );
  }
}

async function checkAccounts() {
  let serviceAccount;
  try {
    serviceAccount = loadServiceAccount();
  } catch (error) {
    return record('fail', 'Firebase', error.message);
  }
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

  const firebaseUids = new Set();
  let pageToken;
  try {
    do {
      const page = await getAuth().listUsers(1000, pageToken);
      for (const user of page.users) firebaseUids.add(user.uid);
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (error) {
    return record('fail', 'Firebase', `${error.code ?? ''} ${error.message}`.trim());
  }

  const rows = await checkedQuery('SELECT firebase_uid FROM users');
  const databaseUids = new Set(rows.map((row) => row.firebaseUid));
  const notRegistered = [...firebaseUids].filter((uid) => !databaseUids.has(uid)).length;
  const cannotSignIn = [...databaseUids].filter((uid) => !firebaseUids.has(uid)).length;
  record('ok', 'Firebase accounts', `${databaseUids.size} in MySQL, ${firebaseUids.size} in Firebase`);
  if (notRegistered) {
    record(
      'warn',
      'sign-in without an account',
      `${notRegistered}: registered in Firebase, no MySQL row (API: USER_NOT_REGISTERED)`,
    );
  }
  if (cannotSignIn) {
    record('warn', 'account without a sign-in', `${cannotSignIn} MySQL accounts whose Firebase user is gone`);
  }
}

async function checkSchoolData() {
  const year = currentAcademicYear();
  const [{ n: unplaced }] = await checkedQuery(
    `SELECT COUNT(*) AS n FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
      WHERE e.id IS NULL`,
  );
  const [{ n: emptyClasses }] = await checkedQuery(
    `SELECT COUNT(*) AS n FROM classes c
      WHERE c.academic_year = ?
        AND NOT EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.class_id = c.id)`,
    [year],
  );
  const [{ n: pendingAssistants }] = await checkedQuery(
    "SELECT COUNT(*) AS n FROM assistant_requests WHERE status = 'pending'",
  );

  if (unplaced) record('warn', 'students without a class', `${unplaced}; Admin > Students lists them`);
  if (emptyClasses)
    record('warn', 'classes with no subject', `${emptyClasses} in ${year}; they can have no lessons`);
  if (pendingAssistants) record('warn', 'assistant requests', `${pendingAssistants} waiting for a decision`);
}

await checkSite(flag('site') ?? DEFAULT_SITE);
await checkApi(flag('api') ?? DEFAULT_API);
await checkDatabase();
await checkAccounts();
if (!isLocalDbHost()) await checkSchoolData();
await closePool();

const failures = results.filter((level) => level === 'fail').length;
console.log(failures ? `\n✖ ${failures} problem(s) to fix.` : '\n✔ The deployed system looks healthy.');
process.exit(failures ? 1 : 0);
