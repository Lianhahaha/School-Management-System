/**
 * MySQL access — one pool, one query helper, one transaction helper.
 *
 * Conventions enforced here so that no repository has to remember them:
 *   - DATE columns arrive as 'YYYY-MM-DD' strings (never shifted by time zones).
 *   - DATETIME columns arrive as JS Dates and serialise to ISO-8601 UTC.
 *   - TIME columns arrive as 'HH:MM'; TINYINT(1) columns arrive as booleans.
 *   - DECIMAL columns arrive as numbers.
 *   - Row keys are converted from snake_case to camelCase on read.
 *   - `withTransaction` is the only place that borrows a connection; it always
 *     releases it. Repositories accept an optional trailing `conn` so the same
 *     function works inside and outside a transaction.
 */
import mysql from 'mysql2/promise';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** mysql2 typeCast: normalise TIME and BOOLEAN columns; everything else uses the default. */
export function typeCast(field, next) {
  if (field.type === 'TIME') {
    const value = field.string();
    return value === null ? null : value.slice(0, 5);
  }
  if (field.type === 'TINY' && field.length === 1) {
    const value = field.string();
    return value === null ? null : value === '1';
  }
  return next();
}

const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

/** Shallow key conversion: rows are flat, and Date/Buffer values are leaves. */
export function camelizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) out[toCamel(key)] = value;
  return out;
}

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 100,
  connectTimeout: 10_000,
  charset: 'utf8mb4_unicode_ci',
  dateStrings: ['DATE'],
  timezone: 'Z',
  decimalNumbers: true,
  supportBigNumbers: true,
  typeCast,
});

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

/**
 * Run a SELECT and return camelCased rows.
 * @param {string} sql
 * @param {unknown[]} [params]
 * @param {import('mysql2/promise').PoolConnection | import('mysql2/promise').Pool} [conn]
 */
export async function query(sql, params = [], conn = pool) {
  const started = performance.now();
  const [rows] = await conn.query(sql, params);
  if (env.LOG_LEVEL === 'debug') {
    logger.debug('sql', {
      ms: Math.round(performance.now() - started),
      rows: rows.length,
      sql: compact(sql),
      params,
    });
  }
  return rows.map(camelizeRow);
}

/**
 * Run an INSERT/UPDATE/DELETE and return the result header (insertId, affectedRows).
 */
export async function run(sql, params = [], conn = pool) {
  const started = performance.now();
  const [result] = await conn.query(sql, params);
  if (env.LOG_LEVEL === 'debug') {
    logger.debug('sql', {
      ms: Math.round(performance.now() - started),
      affected: result.affectedRows,
      sql: compact(sql),
      params,
    });
  }
  return result;
}

async function inTransaction(conn, fn) {
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  }
}

/**
 * Run `fn(conn)` inside a transaction. Commits on success, rolls back on any
 * error, always releases the connection.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    return await inTransaction(conn, fn);
  } finally {
    conn.release();
  }
}

/**
 * Like withTransaction, but `acquire(conn)` takes a session-level lock (GET_LOCK) on the same connection
 * before BEGIN and `release(conn)` frees it after COMMIT or ROLLBACK, so the lock covers the committed write
 * with one pooled connection. If `acquire` throws, nothing runs; if `release` fails, the connection is
 * destroyed so the session (and its lock) ends instead of going back to the pool still holding it.
 */
export async function withLockedTransaction(acquire, release, fn) {
  const conn = await pool.getConnection();
  let reusable = true;
  try {
    await acquire(conn);
    try {
      return await inTransaction(conn, fn);
    } finally {
      await release(conn).catch(() => {
        reusable = false;
      });
    }
  } finally {
    if (reusable) conn.release();
    else conn.destroy();
  }
}

export const ping = () => pool.query('SELECT 1');

export const closePool = () => pool.end();

const compact = (sql) => sql.replace(/\s+/g, ' ').trim();
