/**
 * migrate.js — creates the database and applies database/schema.sql.
 *
 *   npm run db:migrate            create the database (if missing) and every table (IF NOT EXISTS),
 *                                 then apply the in-place upgrades below to an older database
 *   node scripts/migrate.js --fresh   DROP the database first (destructive), then recreate it
 *
 * Uses a dedicated connection with multipleStatements enabled (the API pool
 * never enables it). No mysql command-line client is needed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { dbConnectionOptions } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';

const fresh = process.argv.includes('--fresh');
const schemaPath = path.join(env.backendRoot, 'database', 'schema.sql');

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
];

async function applyUpgrades(conn) {
  for (const upgrade of UPGRADES) {
    const [rows] = await conn.query(upgrade.needed);
    if (rows.length === 0) continue;
    await conn.query(upgrade.apply);
    console.log(`✔ Upgraded: ${upgrade.description}`);
  }
}

const HINTS = {
  ECONNREFUSED: `MySQL is not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start the "MySQL80" service (services.msc or \`net start MySQL80\` in an admin terminal).`,
  ER_ACCESS_DENIED_ERROR:
    'Wrong DB_USER / DB_PASSWORD in backend/.env (wrap the password in double quotes if it contains # or spaces).',
  ER_DBACCESS_DENIED_ERROR: `DB_USER lacks privileges on database ${env.DB_NAME}. Grant them or use the root account.`,
  ETIMEDOUT: `Connection to ${env.DB_HOST}:${env.DB_PORT} timed out. Check DB_HOST/DB_PORT and that MySQL is running.`,
};

async function main() {
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
  const hint = HINTS[error.code];
  console.error(`✖ Migration failed: ${error.code ?? ''} ${error.message}`);
  if (hint) console.error(`  ${hint}`);
  if (error.code === 'ER_PARSE_ERROR' && error.sqlMessage) console.error(`  ${error.sqlMessage}`);
  process.exit(1);
});
