import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pool, run } from '../src/config/db.js';
import { toApiError } from '../src/utils/toApiError.js';
import { api, as, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

const driverError = (code, errno) => Object.assign(new Error(code), { code, errno });

describe('error mapping', () => {
  let admin;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
  });

  it('answers 400, not 500, for a path that cannot be decoded', async () => {
    const res = await api.get('/api/v1/students/%E0%A4').set(as(admin));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details.reason, 'bad_request');
  });

  it('turns deadlocks, lock timeouts and a full pool queue into a retryable 503', () => {
    for (const error of [
      driverError('ER_LOCK_DEADLOCK', 1213),
      driverError('ER_LOCK_WAIT_TIMEOUT', 1205),
      driverError('ER_QUERY_TIMEOUT', 3024),
      new Error('Queue limit reached.'),
    ]) {
      const mapped = toApiError(error);
      assert.equal(mapped.status, 503, error.message);
      assert.equal(mapped.details.reason, 'busy');
    }
  });

  it('turns a dropped database connection into 503 db', () => {
    for (const code of ['ECONNRESET', 'EPIPE', 'PROTOCOL_CONNECTION_LOST']) {
      const mapped = toApiError(driverError(code, undefined));
      assert.equal(mapped.status, 503, code);
      assert.equal(mapped.details.component, 'db');
    }
  });

  it('turns an unreachable or overloaded Firebase into 503 auth', () => {
    for (const code of [
      'app/network-error',
      'app/network-timeout',
      'auth/internal-error',
      'auth/quota-exceeded',
    ]) {
      const mapped = toApiError(driverError(code, undefined));
      assert.equal(mapped.status, 503, code);
      assert.equal(mapped.details.component, 'auth');
    }
  });

  it('lets a browser cache the CORS preflight, and caps how long a SELECT may run', async () => {
    const preflight = await api
      .options('/api/v1/students')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    assert.equal(preflight.headers['access-control-max-age'], '7200');
    const [[row]] = await pool.query('SELECT @@SESSION.max_execution_time AS ms, @@SESSION.time_zone AS tz');
    assert.deepEqual([row.ms, row.tz], [15000, '+00:00']);
  });

  it('still answers 500 for an unknown error', () => {
    assert.equal(toApiError(new Error('boom')).status, 500);
  });

  it('answers 400, not 500, for an id or a date-time past what the columns hold', async () => {
    const enrollment = await api
      .post('/api/v1/enrollments')
      .set(as(admin))
      .send({ studentId: 4294967296, classId: 1 });
    assert.equal(enrollment.status, 400, JSON.stringify(enrollment.body));
    assert.equal(enrollment.body.error.details.issues[0].path, 'body.studentId');
    const lookup = await api.get('/api/v1/students/4294967296').set(as(admin));
    assert.equal(lookup.status, 400);
    const announcement = await api.post('/api/v1/announcements').set(as(admin)).send({
      title: 'Far future',
      body: 'Hello',
      audience: 'all',
      publishedAt: '9999-12-31T23:00:00-05:00',
    });
    assert.equal(announcement.status, 400, JSON.stringify(announcement.body));
    assert.equal(announcement.body.error.details.issues[0].path, 'body.publishedAt');
  });

  it("maps MySQL's out-of-range and wrong-value refusals to 400 with the column", async () => {
    const outOfRange = await run(
      `INSERT INTO enrollments (student_id, class_id, enrolled_on) VALUES (?, 1, '2026-10-01')`,
      [4294967296],
    ).catch((error) => error);
    assert.equal(outOfRange.code, 'ER_WARN_DATA_OUT_OF_RANGE');
    const wrongValue = await run('UPDATE users SET updated_at = ? WHERE id = ?', [
      '10000-01-01 00:00:00',
      admin.id,
    ]).catch((error) => error);
    assert.equal(wrongValue.code, 'ER_TRUNCATED_WRONG_VALUE');
    for (const [error, field] of [
      [outOfRange, 'studentId'],
      [wrongValue, 'updatedAt'],
    ]) {
      const mapped = toApiError(error);
      assert.equal(mapped.status, 400, error.code);
      assert.equal(mapped.details.field, field, error.code);
    }
  });
});
