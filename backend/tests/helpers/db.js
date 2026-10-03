/**
 * Test database lifecycle: create the database if missing, apply schema.sql,
 * and empty every table. Test files run one after another (--test-concurrency=1)
 * because they share the single test database.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { closePool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

const TABLES = [
  'grades',
  'assessments',
  'attendance',
  'schedules',
  'announcements',
  'enrollments',
  'class_subjects',
  'classes',
  'subjects',
  'students',
  'teachers',
  'users',
];

export async function prepareDatabase() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${env.DB_NAME}\``);
    await conn.query(readFileSync(path.join(env.backendRoot, 'database', 'schema.sql'), 'utf8'));
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) await conn.query(`TRUNCATE TABLE \`${table}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await conn.end();
  }
}

export const shutdown = () => closePool();
