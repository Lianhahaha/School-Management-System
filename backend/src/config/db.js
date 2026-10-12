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
import { dbConnectionOptions } from './dbConnection.js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { toCamel } from '../utils/sql.js';

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

/** Column name -> camelCase key. The set of column names is small and fixed, so each is converted once. */
const camelNames = new Map();
const camelName = (key) => {
  let name = camelNames.get(key);
  if (name === undefined) {
    name = toCamel(key);
    camelNames.set(key, name);
  }
  return name;
};

/** Shallow key conversion: rows are flat, and Date/Buffer values are leaves. */
export function camelizeRow(row) {
  const out = {};
  for (const key in row) out[camelName(key)] = row[key];
  return out;
}

/**
 * Queries waiting for a free connection before the pool turns new ones away (answered as 503 "busy").
 * One dashboard load runs about fifteen queries side by side, so a limit of 100 shed load at only seven or
 * eight sign-ins at the same moment. Each query holds a connection for milliseconds and a SELECT is cut off
 * at MAX_SELECT_MS, so a deeper queue costs a short wait, not a stuck request: 1000 holds about seventy
 * simultaneous dashboard loads and still sheds a real overload.
 */
const QUEUE_LIMIT = 1000;

export const pool = mysql.createPool({
  ...dbConnectionOptions(),
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: QUEUE_LIMIT,
  connectTimeout: 10_000,
  // TCP keep-alive on idle connections, so a hosted database (or a NAT on the way) does not silently drop
  // them between requests, and a dead one is noticed instead of hanging the next query.
  enableKeepAlive: true,
  keepAliveInitialDelay: 30_000,
  charset: 'utf8mb4_unicode_ci',
  dateStrings: ['DATE'],
  timezone: 'Z',
  decimalNumbers: true,
  supportBigNumbers: true,
  typeCast,
});

/** A SELECT that runs longer than this is stopped by MySQL (ER_QUERY_TIMEOUT, answered as a retryable 503). */
const MAX_SELECT_MS = 15_000;

pool.on('connection', (connection) => {
  // A callback, so a failure is logged instead of surfacing as an unhandled 'error' event.
  connection.query(`SET time_zone = '+00:00', max_execution_time = ${MAX_SELECT_MS}`, (error) => {
    if (error) logger.error('could not set the session settings', { error: String(error) });
  });
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

/**
 * Run `fn(conn)` inside a transaction on `conn`, a connection the caller already holds (withLockedSession).
 * Commits on success, rolls back on any error; the connection stays the caller's.
 */
export async function inTransaction(conn, fn) {
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
 * Runs `fn(conn)` on one pooled connection while its session holds a lock: `acquire(conn)` takes it (GET_LOCK)
 * and `release(conn)` frees it once `fn` is done, for work of several statements and transactions
 * (inTransaction) that must not overlap another holder of the same lock. Every query of `fn` goes through
 * `conn`: borrowing a second connection while holding this one could exhaust the pool. If `acquire` throws,
 * nothing runs; if `release` fails, the connection is destroyed so the session (and its lock) ends instead of
 * going back to the pool still holding it.
 */
export async function withLockedSession(acquire, release, fn) {
  const conn = await pool.getConnection();
  let reusable = true;
  try {
    await acquire(conn);
    try {
      return await fn(conn);
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

/**
 * Like withTransaction, but under a session-level lock (withLockedSession): `acquire(conn)` takes it before
 * BEGIN and `release(conn)` frees it after COMMIT or ROLLBACK, so the lock covers the committed write with one
 * pooled connection.
 */
export const withLockedTransaction = (acquire, release, fn) =>
  withLockedSession(acquire, release, (conn) => inTransaction(conn, fn));

export const ping = () => pool.query('SELECT 1');

export const closePool = () => pool.end();

const compact = (sql) => sql.replace(/\s+/g, ' ').trim();
