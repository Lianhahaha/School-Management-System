/**
 * migrate.js — creates the database and applies database/schema.sql.
 *
 *   npm run db:migrate            create the database (if missing) and every table (IF NOT EXISTS),
 *                                 then apply the in-place upgrades below to an older database
 *   node scripts/migrate.js --fresh   DROP the database first (destructive), then recreate it.
 *                                 Refused for a database that is not on this machine, or with
 *                                 NODE_ENV=production, unless --allow-remote-drop is also given.
 *
 * Uses a dedicated connection with multipleStatements enabled (the API pool
 * never enables it). No mysql command-line client is needed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { dbConnectionOptions, dbErrorHint } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';

const fresh = process.argv.includes('--fresh');
const allowRemoteDrop = process.argv.includes('--allow-remote-drop');
const schemaPath = path.join(env.backendRoot, 'database', 'schema.sql');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** `db:reset` is a local-development tool: dropping a hosted or production database needs an explicit flag. */
function assertSafeToDrop() {
  const isLocal = LOCAL_HOSTS.has(env.DB_HOST) && !env.isProd;
  if (isLocal || allowRemoteDrop) return;
  console.error(
    `✖ Refusing to drop ${env.DB_NAME} on ${env.DB_HOST}${env.isProd ? ' (NODE_ENV=production)' : ''}.\n` +
      '  --fresh deletes every row. If you really mean this database, add --allow-remote-drop.',
  );
  process.exit(1);
}

// Changes CREATE TABLE IF NOT EXISTS cannot make to a database created by an older schema.sql.
// Each one checks the catalogue first, so running migrate again is a no-op.
const UPGRADES = [
  {
    // Every enrollment is its own row now, so re-joining a class must not collide with the old period.
    description: 'drop enrollments.uq_enrollments_student_class',
    needed: `SELECT 1 FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND INDEX_NAME = 'uq_enrollments_student_class'`,
    apply: 'ALTER TABLE enrollments DROP INDEX uq_enrollments_student_class',
  },
  {
    // K-12 grading: the subject group that sets a subject's component weights (NULL keeps today's grading).
    description: 'add subjects.grading_group',
    needed: `SELECT 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'grading_group')`,
    apply: `ALTER TABLE subjects ADD COLUMN grading_group ENUM('languages','math_science','mapeh') NULL
              COMMENT 'K-12 components group; NULL = points or custom weights' AFTER is_active`,
  },
];

async function applyUpgrades(conn) {
  for (const upgrade of UPGRADES) {
    const [rows] = await conn.query(upgrade.needed);
    if (rows.length === 0) continue;
    await conn.query(upgrade.apply);
    console.log(`✔ Upgraded: ${upgrade.description}`);
  }
}

async function main() {
  if (fresh) assertSafeToDrop();
  const schema = readFileSync(schemaPath, 'utf8');
  const conn = await mysql.createConnection({
    ...dbConnectionOptions(),
    multipleStatements: true,
  });
  try {
    if (fresh) {
      console.warn(`! Dropping database ${env.DB_NAME} (--fresh)`);
      await conn.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
    }
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${env.DB_NAME}\``);
    await conn.query(schema);
    await applyUpgrades(conn);
    const [tables] = await conn.query('SHOW TABLES');
    console.log(`✔ Database ${env.DB_NAME} ready: ${tables.length} tables`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  const hint = dbErrorHint(error);
  console.error(`✖ Migration failed: ${error.code ?? ''} ${error.message}`);
  if (hint) console.error(`  ${hint}`);
  if (error.code === 'ER_PARSE_ERROR' && error.sqlMessage) console.error(`  ${error.sqlMessage}`);
  process.exit(1);
});
