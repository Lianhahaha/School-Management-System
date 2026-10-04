/**
 * Test database lifecycle: drop and recreate the test database from schema.sql before each test
 * file, so schema changes always apply and every file starts empty. Test files run one after
 * another (--test-concurrency=1) because they share the test database; set TEST_DB_NAME to run
 * a second suite against its own database.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { closePool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

export async function prepareDatabase() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    if (!env.DB_NAME.includes('test')) throw new Error(`Refusing to reset non-test database ${env.DB_NAME}`);
    await conn.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${env.DB_NAME}\``);
    await conn.query(readFileSync(path.join(env.backendRoot, 'database', 'schema.sql'), 'utf8'));
  } finally {
    await conn.end();
  }
}

export const shutdown = () => closePool();
