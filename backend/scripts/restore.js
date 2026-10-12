/**
 * restore.js — loads a file made by scripts/backup.js into the database named by DB_NAME, replacing it.
 *
 *   node --env-file=<env file> scripts/restore.js <backup.sql> [--yes-overwrite=<DB_NAME>]
 *
 * The database is dropped and created again (utf8mb4, as `npm run db:migrate` creates it), then the file is
 * loaded, so afterwards it holds exactly what the backup holds. That deletes everything in it, so a database
 * whose name does not contain "test" is refused unless --yes-overwrite names it again, letter for letter.
 * To check a backup, restore it into a test database first: a shell DB_NAME wins over the env file's, e.g.
 * `$env:DB_NAME='school_management_test_restore'` in PowerShell.
 *
 * A file that does not start like a backup, or was cut short (no "Backup complete" line at the end), is
 * refused before anything is dropped. After the load the tables and rows are counted and must match the
 * counts the backup wrote in that last line.
 */
import { closeSync, createReadStream, fstatSync, openSync, readSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import mysql from 'mysql2/promise';
import { dbConnectionOptions, dbErrorHint } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { HEADER, parseFooter } from './lib/backupFile.js';

/** Statements are sent in batches of about this size (each INSERT of a backup is at most about 1 MB). */
const BATCH_BYTES = 4 * 1024 * 1024;

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const confirmed = args.find((arg) => arg.startsWith('--yes-overwrite='))?.slice('--yes-overwrite='.length);

/** Exits before connecting unless DB_NAME is a test database or the overwrite was confirmed by name. */
function assertMayOverwrite() {
  if (env.DB_NAME.includes('test') || confirmed === env.DB_NAME) return;
  console.error(
    `✖ Refusing to overwrite ${env.DB_NAME} on ${env.DB_HOST}: restoring deletes everything in it.\n` +
      `  If you really mean this database, add --yes-overwrite=${env.DB_NAME}.`,
  );
  process.exit(1);
}

/** `length` bytes of the file from `position` (the start, or near the end), as text. */
function readPart(fd, position, length) {
  const buffer = Buffer.alloc(length);
  return buffer.subarray(0, readSync(fd, buffer, 0, length, position)).toString('utf8');
}

/** The counts from the backup's last line; refuses a file that is not a complete backup. */
function readExpectedCounts(backupPath) {
  const fd = openSync(backupPath, 'r');
  try {
    if (!readPart(fd, 0, HEADER.length).startsWith(HEADER)) {
      throw new Error(`${backupPath} is not a backup made by scripts/backup.js`);
    }
    const { size } = fstatSync(fd);
    const tail = readPart(fd, Math.max(0, size - 512), Math.min(size, 512));
    const expected = parseFooter(tail.trimEnd().split('\n').at(-1));
    if (!expected) throw new Error(`${backupPath} is incomplete (no "Backup complete" line at the end)`);
    return expected;
  } finally {
    closeSync(fd);
  }
}

/**
 * The file's statements, in batches: a statement ends with a line ending in ";" (lib/backupFile.js), and
 * comment lines between statements are skipped.
 */
async function* batchesOf(backupPath) {
  const lines = createInterface({ input: createReadStream(backupPath, 'utf8'), crlfDelay: Infinity });
  let statement = [];
  let batch = [];
  let batchBytes = 0;
  for await (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!statement.length && (line === '' || line.startsWith('--'))) continue;
    statement.push(line);
    if (!line.endsWith(';')) continue;
    const sql = statement.join('\n');
    statement = [];
    batch.push(sql);
    batchBytes += sql.length;
    if (batchBytes >= BATCH_BYTES) {
      yield batch.join('\n');
      batch = [];
      batchBytes = 0;
    }
  }
  if (statement.length) throw new Error('the backup ends in the middle of a statement');
  if (batch.length) yield batch.join('\n');
}

/** `{ tables, rows }` of the database the connection is using. */
async function countTablesAndRows(conn) {
  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );
  let rows = 0;
  for (const { name } of tables) {
    const [[{ count }]] = await conn.query(mysql.format('SELECT COUNT(*) AS count FROM ??', [name]));
    rows += Number(count);
  }
  return { tables: tables.length, rows };
}

async function main() {
  if (!file) {
    console.error(
      'Usage: node --env-file=<env file> scripts/restore.js <backup.sql> [--yes-overwrite=<DB_NAME>]',
    );
    process.exit(1);
  }
  assertMayOverwrite();
  const backupPath = path.resolve(file);
  const expected = readExpectedCounts(backupPath);

  const conn = await mysql.createConnection({ ...dbConnectionOptions(), multipleStatements: true });
  try {
    console.warn(`! Replacing database ${env.DB_NAME} on ${env.DB_HOST} with ${backupPath}`);
    await conn.query(mysql.format('DROP DATABASE IF EXISTS ??', [env.DB_NAME]));
    await conn.query(
      mysql.format('CREATE DATABASE ?? DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci', [
        env.DB_NAME,
      ]),
    );
    await conn.query(mysql.format('USE ??', [env.DB_NAME]));
    // One session for the whole file: the settings its first lines make (foreign key checks off) hold to the end.
    for await (const batch of batchesOf(backupPath)) await conn.query(batch);
    const loaded = await countTablesAndRows(conn);
    if (loaded.tables !== expected.tables || loaded.rows !== expected.rows) {
      throw new Error(
        `loaded ${loaded.tables} tables and ${loaded.rows} rows, but the backup has ` +
          `${expected.tables} tables and ${expected.rows} rows`,
      );
    }
    console.log(`✔ Restored ${env.DB_NAME}: ${loaded.tables} tables, ${loaded.rows} rows`);
  } finally {
    await conn.end().catch(() => conn.destroy());
  }
}

main().catch((error) => {
  const hint = dbErrorHint(error);
  console.error(`✖ Restore failed: ${error.code ?? ''} ${error.message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
});
