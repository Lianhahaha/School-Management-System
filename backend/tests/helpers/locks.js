/**
 * Replays races deterministically: a second MySQL session holds row locks, the requests under test
 * queue up behind them, and the test releases the session once they are all waiting.
 */
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

/** A connection to the test database outside the application pool. Close it with `end()`. */
export function openSession() {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

/** Resolves once `count` transactions on the test database wait for a lock; fails after about 5 seconds. */
export async function waitForLockWaits(count) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [{ waiting }] = await query(
      `SELECT COUNT(DISTINCT engine_transaction_id) AS waiting
         FROM performance_schema.data_locks
        WHERE object_schema = DATABASE() AND lock_status = 'WAITING'`,
    );
    if (waiting >= count) return;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${count} transaction(s) to block on a lock`);
}

/**
 * Resolves once `count` sessions on the test database wait for a named lock (GET_LOCK); fails after about
 * 5 seconds. Named locks are server-wide, so the waiting sessions are told apart by their current database.
 */
export async function waitForNamedLockWaits(count) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [{ waiting }] = await query(
      `SELECT COUNT(*) AS waiting
         FROM performance_schema.metadata_locks ml
         JOIN performance_schema.threads th ON th.thread_id = ml.owner_thread_id
        WHERE ml.object_type = 'USER LEVEL LOCK' AND ml.lock_status = 'PENDING'
          AND th.processlist_db = DATABASE()`,
    );
    if (waiting >= count) return;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${count} session(s) to block on a named lock`);
}
