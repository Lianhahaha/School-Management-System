/**
 * Brings the database named by DB_NAME up to date with database/schema.sql and database/upgrades.js.
 * `npm run db:migrate` runs it by hand. With MIGRATE_ON_START=true the API also runs it at every start-up
 * (src/server.js), so a deploy migrates the hosted database before it serves a request.
 *
 * What has run is recorded in schema_migrations: one row per upgrade id, plus a "schema.sql" row holding the
 * SHA-256 of the schema file last applied. A start-up with nothing new costs one lock and one SELECT. When
 * schema.sql has changed, it is applied again (its CREATE TABLE IF NOT EXISTS adds new tables and leaves
 * existing ones alone); then every upgrade not yet recorded runs if its `needed` check says so.
 *
 * MySQL commits each ALTER on its own, so an upgrade and its record cannot share a transaction. The `needed`
 * check closes that gap: an upgrade that ran but was not recorded is recorded on the next run, not repeated.
 * A named lock lets only one process migrate at a time (two instances starting during a deploy).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { UPGRADES } from '../../database/upgrades.js';
import { dbConnectionOptions } from './dbConnection.js';
import { env } from './env.js';

const SCHEMA_ID = 'schema.sql';
const SCHEMA_PATH = path.join(env.backendRoot, 'database', SCHEMA_ID);

/** Seconds to wait for another process's migration to finish before giving up. */
const LOCK_WAIT_S = 60;

/** Bookkeeping for this module only; the application's tables are all in schema.sql. */
const CREATE_SCHEMA_MIGRATIONS = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id          VARCHAR(100) NOT NULL COMMENT '"schema.sql", or the id of an upgrade in database/upgrades.js',
  checksum    CHAR(64)     NULL     COMMENT 'SHA-256 of schema.sql when it was last applied; NULL for an upgrade',
  applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * @param {object} [options]
 * @param {(message: string) => void} [options.log] told about each step that changes something
 * @param {ReadonlyArray<{ id: string, description: string, needed: string, apply: string }>} [options.upgrades]
 * @returns {Promise<string[]>} the ids applied or recorded by this run ("schema.sql" and upgrade ids); empty
 *   when the database was already up to date
 */
export async function migrateDatabase({ log = () => {}, upgrades = UPGRADES } = {}) {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const checksum = sha256(schema);
  const lockName = `${env.DB_NAME}:migrate`;
  const conn = await mysql.createConnection({
    ...dbConnectionOptions(),
    database: env.DB_NAME,
    multipleStatements: true,
  });
  try {
    const [[{ locked }]] = await conn.query('SELECT GET_LOCK(?, ?) AS locked', [lockName, LOCK_WAIT_S]);
    if (locked !== 1) throw new Error(`another process has been migrating ${env.DB_NAME} for over ${LOCK_WAIT_S} s`);
    try {
      await conn.query(CREATE_SCHEMA_MIGRATIONS);
      const [rows] = await conn.query('SELECT id, checksum FROM schema_migrations');
      const recorded = new Map(rows.map((row) => [row.id, row.checksum]));
      const changed = [];

      if (recorded.get(SCHEMA_ID) !== checksum) {
        await conn.query(schema);
        await conn.query(
          `INSERT INTO schema_migrations (id, checksum) VALUES (?, ?) AS new
             ON DUPLICATE KEY UPDATE checksum = new.checksum, applied_at = CURRENT_TIMESTAMP`,
          [SCHEMA_ID, checksum],
        );
        log(`Applied ${SCHEMA_ID}`);
        changed.push(SCHEMA_ID);
      }

      for (const upgrade of upgrades) {
        if (recorded.has(upgrade.id)) continue;
        const [needed] = await conn.query(upgrade.needed);
        if (needed.length > 0) {
          await conn.query(upgrade.apply);
          log(`Upgraded: ${upgrade.description} (${upgrade.id})`);
        }
        await conn.query('INSERT INTO schema_migrations (id) VALUES (?)', [upgrade.id]);
        changed.push(upgrade.id);
      }
      return changed;
    } finally {
      // Ending the session frees the lock as well, so a failure here must not hide the error above.
      await conn.query('DO RELEASE_LOCK(?)', [lockName]).catch(() => {});
    }
  } finally {
    await conn.end().catch(() => conn.destroy());
  }
}
