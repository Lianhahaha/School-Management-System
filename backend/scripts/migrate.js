/**
 * migrate.js — creates the database, then brings it up to date (src/config/migrations.js).
 *
 *   npm run db:migrate            create the database (if missing), every table (IF NOT EXISTS) and
 *                                 the upgrades in database/upgrades.js not yet recorded
 *   node scripts/migrate.js --fresh   DROP the database first (destructive), then recreate it.
 *                                 Refused for a database that is not on this machine, or with
 *                                 NODE_ENV=production, unless --allow-remote-drop is also given.
 *
 * With MIGRATE_ON_START=true the API runs the same migration at every start-up, so a deploy needs no manual
 * step; without it, run this against the hosted database before the code that needs the change. It also
 * creates a new database and runs --fresh. No mysql command-line client is needed.
 */
import mysql from 'mysql2/promise';
import { dbConnectionOptions, dbErrorHint } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { migrateDatabase } from '../src/config/migrations.js';

const fresh = process.argv.includes('--fresh');
const allowRemoteDrop = process.argv.includes('--allow-remote-drop');

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

/** The migration connects to DB_NAME, so the database itself is created (or dropped) here first. */
async function prepareDatabase() {
  const conn = await mysql.createConnection(dbConnectionOptions());
  try {
    if (fresh) {
      console.warn(`! Dropping database ${env.DB_NAME} (--fresh)`);
      await conn.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
    }
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

async function main() {
  if (fresh) assertSafeToDrop();
  await prepareDatabase();
  const changed = await migrateDatabase({ log: (message) => console.log(`✔ ${message}`) });
  console.log(
    changed.length === 0
      ? `✔ Database ${env.DB_NAME} is up to date`
      : `✔ Database ${env.DB_NAME} ready (${changed.length} step${changed.length === 1 ? '' : 's'} recorded)`,
  );
}

main().catch((error) => {
  const hint = dbErrorHint(error);
  console.error(`✖ Migration failed: ${error.code ?? ''} ${error.message}`);
  if (hint) console.error(`  ${hint}`);
  if (error.code === 'ER_PARSE_ERROR' && error.sqlMessage) console.error(`  ${error.sqlMessage}`);
  process.exit(1);
});
