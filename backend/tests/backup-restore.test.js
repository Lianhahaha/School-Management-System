import './helpers/setup.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { query, run } from '../src/config/db.js';
import { dbConnectionOptions } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { todayYmd } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

const execFileAsync = promisify(execFile);

/** Runs a backend script in its own process (config/env.js reads DB_NAME once per process). */
async function runScript(script, args = [], extraEnv = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [`scripts/${script}`, ...args], {
      cwd: env.backendRoot,
      env: { ...process.env, ...extraEnv },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

/** Text no ordinary value has: quotes, a backslash, line breaks around a ";", a tab, a NUL, accents and an emoji. */
const AWKWARD = 'O\'Brien "Ñiño" \\ back;\nslash;\r\n\tend\u0000 🙂';

/**
 * scripts/backup.js and scripts/restore.js: a backup of the test database restored into another test database
 * gives the same tables, the same rows (counted and checksummed per table) and the same awkward values.
 */
describe('backup and restore', () => {
  const RESTORED = `${env.DB_NAME}_restored`;
  let conn;
  let outDir;
  let backupFile;
  let backupText;
  const rows = async (sql, params) => (await conn.query(sql, params))[0];
  const tablesOf = async (database) =>
    (
      await rows(
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
        [database],
      )
    ).map((row) => row.name);
  /** What information_schema says about every column of a table, the character set and collation included. */
  const columnsOf = (database, table) =>
    rows(
      `SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
              GENERATION_EXPRESSION, COLUMN_COMMENT
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [database, table],
    );
  /**
   * Per table: its definition, columns, row count and CHECKSUM TABLE. MySQL prints "CHARACTER SET" beside a
   * column's COLLATE once a CREATE TABLE states the collation, as every dump's does (mysqldump's too), so the
   * definition is compared without it; the columns' character sets and collations are compared as they are.
   */
  const snapshotOf = async (database) => {
    const snapshot = {};
    for (const table of await tablesOf(database)) {
      const id = mysql.format('??.??', [database, table]);
      const [definition] = await rows(`SHOW CREATE TABLE ${id}`);
      const [{ count }] = await rows(`SELECT COUNT(*) AS count FROM ${id}`);
      const [{ Checksum }] = await rows(`CHECKSUM TABLE ${id}`);
      snapshot[table] = {
        definition: definition['Create Table'].replace(/ CHARACTER SET \w+ COLLATE /g, ' COLLATE '),
        columns: await columnsOf(database, table),
        count,
        checksum: Checksum,
      };
    }
    return snapshot;
  };
  const databaseExists = async (database) =>
    (await rows('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [database])).length > 0;

  before(async () => {
    assert.ok(RESTORED.includes('test') && RESTORED.length <= 54, `unusable database name ${RESTORED}`);
    await resetWorld();
    const { admin, owner, s1, csA } = await buildSchool();
    const today = todayYmd();
    // Rows of every kind of column: DECIMAL scores, TIME periods, DATE and DATETIME, JSON details, a generated
    // column (enrollments.active_flag) and text that needs escaping.
    const expect201 = (res) => assert.equal(res.status, 201, JSON.stringify(res.body));
    expect201(
      await api
        .post('/api/v1/schedules')
        .set(as(admin))
        .send({ classSubjectId: csA.id, dayOfWeek: 1, startTime: '07:30', endTime: '08:15', room: 'R-1' }),
    );
    const quiz = await api.post('/api/v1/assessments').set(as(owner)).send({
      classSubjectId: csA.id,
      title: 'Quiz 1',
      type: 'quiz',
      term: 'term1',
      maxScore: 20,
      assessedOn: today,
    });
    expect201(quiz);
    const graded = await api
      .put(`/api/v1/assessments/${quiz.body.data.id}/grades`)
      .set(as(owner))
      .send({ grades: [{ studentId: s1.studentId, score: 17.5, remarks: 'Good work' }] });
    assert.equal(graded.status, 200, JSON.stringify(graded.body));
    expect201(
      await api
        .post('/api/v1/announcements')
        .set(as(admin))
        .send({ title: 'Welcome', body: 'Hello', audience: 'all' }),
    );
    expect201(
      await api
        .post('/api/v1/calendar-events')
        .set(as(admin))
        .send({ title: 'Foundation Day', type: 'event', startsOn: today }),
    );
    await run('UPDATE users SET last_name = ? WHERE id = ?', [AWKWARD, s1.id]);
    await run('UPDATE announcements SET body = ?', [AWKWARD]);
    await run('UPDATE grades SET remarks = ?', [AWKWARD]);
    await run('UPDATE activity_log SET details = CAST(? AS JSON) ORDER BY id LIMIT 1', [
      JSON.stringify({ note: AWKWARD, number: 18000.5, nested: [null, true, { deep: 'ok' }] }),
    ]);
    // The schema's own conventions, so a dump that only works on empty tables would fail here.
    assert.ok((await query('SELECT COUNT(*) AS n FROM enrollments WHERE active_flag = 1'))[0].n > 0);

    conn = await mysql.createConnection(dbConnectionOptions());
    await conn.query(mysql.format('DROP DATABASE IF EXISTS ??', [RESTORED]));
    outDir = mkdtempSync(path.join(os.tmpdir(), 'skole-backup-test-'));
  });

  after(async () => {
    if (outDir) rmSync(outDir, { recursive: true, force: true });
    if (!conn) return;
    await conn.query(mysql.format('DROP DATABASE IF EXISTS ??', [RESTORED]));
    await conn.end();
  });

  it('writes one complete file, read-only, with every table and row', async () => {
    const before = await snapshotOf(env.DB_NAME);
    const { code, stdout, stderr } = await runScript('backup.js', [outDir]);
    assert.equal(code, 0, stderr);
    assert.deepEqual(await snapshotOf(env.DB_NAME), before, 'the backup changed nothing');

    const files = readdirSync(outDir);
    assert.equal(files.length, 1, `one file and no .partial left: ${files}`);
    assert.match(files[0], new RegExp(`^${env.DB_NAME}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}Z\\.sql$`));
    backupFile = path.join(outDir, files[0]);
    backupText = readFileSync(backupFile, 'utf8');

    const tables = Object.keys(before);
    const totalRows = Object.values(before).reduce((sum, table) => sum + table.count, 0);
    assert.match(stdout, new RegExp(`Backed up ${env.DB_NAME}: ${tables.length} tables, ${totalRows} rows`));
    assert.ok(backupText.startsWith(`-- Skole backup of \`${env.DB_NAME}\``));
    assert.match(
      backupText,
      /^SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;$/m,
    );
    assert.ok(backupText.endsWith(`-- Backup complete: ${tables.length} tables, ${totalRows} rows\n`));
    for (const table of tables) assert.match(backupText, new RegExp(`^CREATE TABLE \`${table}\` \\(`, 'm'));
  });

  it('leaves generated columns out of the INSERTs and keeps columns with a default expression', () => {
    const insertColumns = (table) =>
      new RegExp(`^INSERT INTO \`${table}\` \\((.+)\\) VALUES$`, 'm').exec(backupText)[1].split(', ');
    const enrollments = insertColumns('enrollments');
    assert.equal(enrollments.includes('`active_flag`'), false);
    assert.equal(enrollments.includes('`created_at`'), true, 'DEFAULT CURRENT_TIMESTAMP is not generated');
  });

  it('restores into another test database: same tables, rows, checksums and values', async () => {
    const { code, stdout, stderr } = await runScript('restore.js', [backupFile], { DB_NAME: RESTORED });
    assert.equal(code, 0, stderr);
    assert.match(stdout, new RegExp(`Restored ${RESTORED}: `));

    const [original, restored] = await Promise.all([snapshotOf(env.DB_NAME), snapshotOf(RESTORED)]);
    assert.deepEqual(Object.keys(restored), Object.keys(original));
    for (const table of Object.keys(original)) {
      assert.deepEqual(restored[table], original[table], `${table} differs after the restore`);
    }
    const valuesOf = (database) =>
      rows(
        mysql.format(
          `SELECT (SELECT body FROM ??.announcements LIMIT 1) AS body,
                  (SELECT remarks FROM ??.grades LIMIT 1) AS remarks,
                  (SELECT score FROM ??.grades LIMIT 1) AS score,
                  (SELECT details FROM ??.activity_log ORDER BY id LIMIT 1) AS details,
                  (SELECT GROUP_CONCAT(max_score ORDER BY id) FROM ??.assessments) AS maxScores,
                  (SELECT GROUP_CONCAT(start_time) FROM ??.schedules) AS periods`,
          Array(6).fill(database),
        ),
      );
    const [values] = await valuesOf(RESTORED);
    assert.deepEqual([values], await valuesOf(env.DB_NAME));
    assert.equal(values.body, AWKWARD);
    assert.equal(values.details.note, AWKWARD);
    assert.equal(values.maxScores, '20.00');
  });

  it('refuses to restore a backup that was cut short, before dropping anything', async () => {
    const cut = path.join(outDir, 'cut.sql');
    writeFileSync(cut, backupText.slice(0, backupText.lastIndexOf('-- Backup complete')));
    const { code, stderr } = await runScript('restore.js', [cut], { DB_NAME: RESTORED });
    assert.equal(code, 1);
    assert.match(stderr, /incomplete/);
    assert.ok((await tablesOf(RESTORED)).length > 0, 'the database was left alone');
  });

  it('refuses a database whose name lacks "test" unless --yes-overwrite names it', async () => {
    const guarded = 'skole_restore_guard_check';
    for (const args of [[backupFile], [backupFile, '--yes-overwrite=another_database']]) {
      const { code, stderr } = await runScript('restore.js', args, { DB_NAME: guarded });
      assert.equal(code, 1);
      assert.match(stderr, new RegExp(`Refusing to overwrite ${guarded}`));
      assert.match(stderr, new RegExp(`--yes-overwrite=${guarded}`));
    }
    assert.equal(await databaseExists(guarded), false, 'refused before connecting');
  });

  it('refuses to write a backup inside the repository', async () => {
    const inside = path.join(env.backendRoot, 'tests', 'backup-refused');
    const { code, stderr } = await runScript('backup.js', [inside]);
    assert.equal(code, 1);
    assert.match(stderr, /inside the repository/);
    assert.equal(existsSync(inside), false);
  });
});
