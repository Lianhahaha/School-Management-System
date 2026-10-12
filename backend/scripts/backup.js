/**
 * backup.js — a full, read-only dump of the database named by DB_NAME into one .sql file.
 *
 *   node --env-file=<env file> scripts/backup.js [outDir]
 *
 * It connects like scripts/migrate.js (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_SSL...). `outDir` defaults to
 * the backups folder in your home folder (%USERPROFILE%\.skole\backups on Windows), created when missing. A
 * folder inside this repository is refused: a backup holds every student's personal data and must never be
 * committed, nor synced by OneDrive with the code. The file is <DB_NAME>-<UTC date and time>.sql; it gets its
 * name only once complete, so a failed run leaves no file that looks like a backup.
 *
 * What it writes: settings that switch foreign key and unique checks off for the load, then for every table its
 * CREATE TABLE (SHOW CREATE TABLE, with the AUTO_INCREMENT counter) and INSERTs of all its rows, in primary key
 * order. Values are escaped by mysql2 and read so that nothing changes on the way: DATE, DATETIME and TIME as
 * the server's text, DECIMAL and BIGINT as exact digits, JSON as its text, binary columns as hex. Generated
 * columns are left out of the INSERTs; the server computes them again.
 *
 * Everything is read in one transaction, START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY: the file is the
 * database at one instant even while the API keeps writing, and the script cannot change anything. A database
 * with views, triggers, stored routines or events is refused, because they would be missing from the file
 * (Skole has none).
 *
 * Restore with scripts/restore.js, or load the file with the mysql client into an empty database. README,
 * "Before every live migration: back up", has the commands.
 */
import { once } from 'node:events';
import { createWriteStream, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { dbConnectionOptions, dbErrorHint } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { HEADER, LOAD_SETTINGS, RESTORE_SETTINGS, footerLine, isInside, repoRoot } from './lib/backupFile.js';

const DEFAULT_OUT_DIR = path.join(os.homedir(), '.skole', 'backups');

/** An INSERT is closed once its values reach this size, well under any server's max_allowed_packet. */
const MAX_INSERT_BYTES = 1024 * 1024;

/** 2026-10-12T05:30:00.000Z -> 2026-10-12T05-30-00Z (a file name Windows accepts). */
const fileStamp = (date) => `${date.toISOString().slice(0, 19).replaceAll(':', '-')}Z`;

/** The output folder, refused when it is inside the repository. */
function outputFolder() {
  const folder = path.resolve(process.argv[2] ?? DEFAULT_OUT_DIR);
  if (isInside(repoRoot, folder)) {
    throw new Error(
      `${folder} is inside the repository. A backup holds personal data and must stay out of it; ` +
        `leave the folder out to use ${DEFAULT_OUT_DIR}.`,
    );
  }
  return folder;
}

/** Writes `text` to the file, waiting while the stream's buffer is full. */
async function write(out, text) {
  if (!out.write(text)) await once(out, 'drain');
}

/**
 * Writes one statement. The restore splits the file at lines ending in ";", so a statement may hold no
 * other one: row values never do (escaping turns line breaks into \n), a table definition is checked.
 */
function writeStatement(out, sql) {
  if (/;\r?\n/.test(sql))
    throw new Error(`a statement would contain a line ending in ";": ${sql.slice(0, 80)}`);
  return write(out, `${sql};\n`);
}

const rows = async (conn, sql, params) => (await conn.query(sql, params))[0];

/** Refuses a database that holds objects this script does not copy. */
async function assertOnlyTables(conn) {
  const [counts] = await rows(
    conn,
    `SELECT
       (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()) AS views,
       (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()) AS triggers,
       (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()) AS routines,
       (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE()) AS events`,
  );
  const found = Object.entries(counts).filter(([, count]) => Number(count) > 0);
  if (found.length) {
    throw new Error(
      `the database has ${found.map(([kind, count]) => `${count} ${kind}`).join(', ')}, which this backup ` +
        'does not copy; use mysqldump instead',
    );
  }
}

/** The columns an INSERT lists (generated ones left out) and the primary key, for one table. */
async function columnsOf(conn, table) {
  const columns = await rows(
    conn,
    `SELECT COLUMN_NAME AS name, EXTRA AS extra FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table],
  );
  const primaryKey = await rows(
    conn,
    `SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`,
    [table],
  );
  return {
    // EXTRA is 'STORED GENERATED' or 'VIRTUAL GENERATED' for a generated column ('DEFAULT_GENERATED' is a
    // column with a default expression such as CURRENT_TIMESTAMP, which is copied like any other).
    insertable: columns
      .filter((column) => !/\b(STORED|VIRTUAL) GENERATED\b/.test(column.extra))
      .map((c) => c.name),
    primaryKey: primaryKey.map((column) => column.name),
  };
}

/** Writes the INSERTs of one table's rows, streamed from the server; returns how many rows there were. */
async function dumpRows(conn, out, table) {
  const { insertable, primaryKey } = await columnsOf(conn, table);
  const order = primaryKey.length ? mysql.format(' ORDER BY ??', [primaryKey]) : '';
  const select = mysql.format(`SELECT ?? FROM ??${order}`, [insertable, table]);
  const prefix = mysql.format('INSERT INTO ?? (??) VALUES\n', [table, insertable]);
  let pending = [];
  let pendingBytes = 0;
  let count = 0;
  const flush = async () => {
    if (!pending.length) return;
    await writeStatement(out, prefix + pending.join(',\n'));
    pending = [];
    pendingBytes = 0;
  };
  // The callback connection underneath streams the rows, so a large table is never held in memory.
  const stream = conn.connection.query({ sql: select, rowsAsArray: true }).stream();
  for await (const row of stream) {
    const values = mysql.format('(?)', [row]);
    pending.push(values);
    pendingBytes += values.length;
    count += 1;
    if (pendingBytes >= MAX_INSERT_BYTES) await flush();
  }
  await flush();
  return count;
}

async function backup(folder) {
  const conn = await mysql.createConnection({
    ...dbConnectionOptions(),
    database: env.DB_NAME,
    // Values exactly as the server has them: no Date objects, no rounding, no parsed JSON.
    dateStrings: true,
    jsonStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const takenAt = new Date();
  const file = path.join(folder, `${env.DB_NAME}-${fileStamp(takenAt)}.sql`);
  const partial = `${file}.partial`;
  let out;
  try {
    // TIMESTAMP columns (if any) are read and written in UTC, so the copy does not depend on time zones.
    await conn.query("SET SESSION time_zone = '+00:00'");
    // Table definitions with `backticks`, which every server reads: a server running with ANSI_QUOTES (the
    // live one on Aiven runs in ANSI mode, which includes it) writes "double quotes" in SHOW CREATE TABLE,
    // which a server without it, like a local MySQL, refuses to load. Both ANSI and ANSI_QUOTES go, or ANSI
    // would bring the quotes back. Only this session's mode changes.
    await conn.query(
      `SET SESSION sql_mode = TRIM(BOTH ',' FROM
         REPLACE(REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',ANSI_QUOTES,', ','), ',ANSI,', ','))`,
    );
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    await assertOnlyTables(conn);
    const tables = (
      await rows(
        conn,
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      )
    ).map((table) => table.name);

    mkdirSync(folder, { recursive: true });
    out = createWriteStream(partial, { flags: 'wx', mode: 0o600 });
    await write(
      out,
      `${HEADER} of \`${env.DB_NAME}\` on ${env.DB_HOST}, taken ${takenAt.toISOString()} (consistent snapshot)\n` +
        '-- Load it into an EMPTY database: scripts/restore.js, or the mysql client (README).\n\n' +
        `${LOAD_SETTINGS}\n\n`,
    );
    let total = 0;
    for (const table of tables) {
      const [definition] = await rows(conn, mysql.format('SHOW CREATE TABLE ??', [table]));
      await write(out, `-- Table ${table}\n`);
      await writeStatement(out, definition['Create Table']);
      total += await dumpRows(conn, out, table);
      await write(out, '\n');
    }
    await write(out, `${RESTORE_SETTINGS}\n${footerLine(tables.length, total)}\n`);
    out.end();
    await once(out, 'finish');
    await conn.query('COMMIT');
    renameSync(partial, file);
    return { file, tables: tables.length, rows: total };
  } catch (error) {
    if (out) {
      out.destroy();
      rmSync(partial, { force: true });
    }
    throw error;
  } finally {
    await conn.end().catch(() => conn.destroy());
  }
}

async function main() {
  const { file, tables, rows: count } = await backup(outputFolder());
  const kilobytes = Math.ceil(statSync(file).size / 1024);
  console.log(`✔ Backed up ${env.DB_NAME}: ${tables} tables, ${count} rows (${kilobytes} KB)`);
  console.log(`  ${file}`);
}

main().catch((error) => {
  const hint = dbErrorHint(error);
  console.error(`✖ Backup failed: ${error.code ?? ''} ${error.message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
});
