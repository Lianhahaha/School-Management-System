import './helpers/setup.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { UPGRADES } from '../database/upgrades.js';
import { dbConnectionOptions } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';

const execFileAsync = promisify(execFile);

/** The oldest schema.sql the upgrades support; the fixture's header names the commit it comes from. */
const OLDEST_SCHEMA = path.join(env.backendRoot, 'tests', 'fixtures', 'schema-7494cab.sql');
const SCHEMA_SQL = readFileSync(path.join(env.backendRoot, 'database', 'schema.sql'), 'utf8');

// Named after this run's test database, so a suite started with its own TEST_DB_NAME gets its own pair.
const FRESH = `${env.DB_NAME}_parity_a`;
const UPGRADED = `${env.DB_NAME}_parity_b`;

/**
 * Runs `npm run db:migrate` (scripts/migrate.js, which calls src/config/migrations.js) against `database` in
 * a child process: config/env.js reads DB_NAME once per process. Returns what it printed.
 */
async function migrate(database) {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/migrate.js'], {
    cwd: env.backendRoot,
    env: { ...process.env, DB_NAME: database },
  });
  return stdout;
}

/**
 * A fresh install and a database created by the oldest schema.sql and then migrated must end up the same:
 * every change to an existing table in schema.sql needs its upgrade in database/upgrades.js, or databases
 * created before the change (the live one) silently differ from new ones.
 */
describe('schema parity: an upgraded database equals a fresh install', () => {
  let conn;
  const rows = async (sql, params) => (await conn.query(sql, params))[0];
  const tablesOf = async (database) =>
    (
      await rows(
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
        [database],
      )
    ).map((row) => row.name);
  /** SHOW CREATE TABLE of every table, keyed by table, without the AUTO_INCREMENT counter (data, not schema). */
  const definitionsOf = async (database) => {
    const definitions = {};
    for (const table of await tablesOf(database)) {
      const [row] = await rows(`SHOW CREATE TABLE \`${database}\`.\`${table}\``);
      definitions[table] = row['Create Table'].replace(/ AUTO_INCREMENT=\d+/, '');
    }
    return definitions;
  };
  const migrationsOf = (database) =>
    rows(`SELECT id, checksum, applied_at FROM \`${database}\`.schema_migrations ORDER BY id`);
  const dropBoth = () =>
    Promise.all([FRESH, UPGRADED].map((database) => conn.query(`DROP DATABASE IF EXISTS \`${database}\``)));

  before(async () => {
    for (const database of [FRESH, UPGRADED]) {
      assert.ok(database.includes('test'), `refusing to use ${database}: not a test database`);
      assert.ok(database.length <= 54, `${database} is longer than DB_NAME allows; shorten TEST_DB_NAME`);
    }
    conn = await mysql.createConnection({ ...dbConnectionOptions(), multipleStatements: true });
    await dropBoth();
    // A fresh install: `npm run db:migrate` on a server without the database.
    await migrate(FRESH);
    // A database created by the oldest schema.sql (as the old migrate script did), then migrated to today.
    await conn.query(
      `CREATE DATABASE \`${UPGRADED}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${UPGRADED}\``);
    await conn.query(readFileSync(OLDEST_SCHEMA, 'utf8'));
    await migrate(UPGRADED);
  });

  after(async () => {
    if (!conn) return;
    await dropBoth();
    await conn.end();
  });

  it('starts from an older schema that the upgrades really change', async () => {
    const [{ count }] = await rows(
      `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'enrollments' AND INDEX_NAME = 'uq_enrollments_student_class'`,
      [UPGRADED],
    );
    assert.equal(count, 0, 'the first upgrade dropped the key the oldest schema has');
    assert.match(readFileSync(OLDEST_SCHEMA, 'utf8'), /UNIQUE KEY uq_enrollments_student_class/);
  });

  it('has the same tables: every table of schema.sql, and schema_migrations', async () => {
    const fresh = await tablesOf(FRESH);
    const inSchema = [...SCHEMA_SQL.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+)/gm)].map((match) => match[1]);
    assert.deepEqual(fresh, [...inSchema, 'schema_migrations'].sort());
    assert.deepEqual(await tablesOf(UPGRADED), fresh);
  });

  it('defines every table the same way (SHOW CREATE TABLE)', async () => {
    const [upgraded, fresh] = await Promise.all([definitionsOf(UPGRADED), definitionsOf(FRESH)]);
    const differing = Object.keys(fresh).filter((table) => upgraded[table] !== fresh[table]);
    const only = (definitions) => Object.fromEntries(differing.map((table) => [table, definitions[table]]));
    // Only the tables that differ, so the assertion's diff shows each difference and nothing else.
    assert.deepEqual(only(upgraded), only(fresh), `tables that differ after the upgrades: ${differing}`);
  });

  it('records schema.sql and every upgrade the same way', async () => {
    const recorded = async (database) =>
      (await migrationsOf(database)).map(({ id, checksum }) => ({ id, checksum }));
    const upgraded = await recorded(UPGRADED);
    assert.deepEqual(upgraded, await recorded(FRESH));
    assert.deepEqual(
      upgraded.map((row) => row.id),
      ['schema.sql', ...UPGRADES.map((upgrade) => upgrade.id)].sort(),
    );
  });

  it('changes nothing when the upgraded database is migrated again', async () => {
    const [definitions, migrations] = await Promise.all([definitionsOf(UPGRADED), migrationsOf(UPGRADED)]);
    const output = await migrate(UPGRADED);
    assert.match(output, /is up to date/);
    assert.deepEqual(await definitionsOf(UPGRADED), definitions);
    assert.deepEqual(await migrationsOf(UPGRADED), migrations);
  });
});
