import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { toApiError } from '../src/middleware/errorHandler.js';
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

  it('still answers 500 for an unknown error', () => {
    assert.equal(toApiError(new Error('boom')).status, 500);
  });
});
