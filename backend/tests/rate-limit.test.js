import './helpers/lowRateLimit.js';
import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, as, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

/**
 * The per-user limit (middleware/rateLimit) and the security headers (app.js). The limit is 5 a minute here
 * (helpers/lowRateLimit.js); the application's default is 600.
 */
describe('rate limit and security headers', () => {
  let ana;
  let ben;

  before(async () => {
    await resetWorld();
    ana = await makeUser('student');
    ben = await makeUser('student');
  });

  it('answers 429 with Retry-After once a user goes past the limit, and only that user', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await api.get('/api/v1/auth/me').set(as(ana));
      assert.equal(res.status, 200);
    }
    const limited = await api.get('/api/v1/auth/me').set(as(ana));
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
    assert.ok(Number(limited.headers['retry-after']) >= 1);

    // Same address, another user: counted apart, so one busy classroom never locks out the rest.
    const other = await api.get('/api/v1/auth/me').set(as(ben));
    assert.equal(other.status, 200);
  });

  it('does not count a request whose sign-in is refused', async () => {
    const res = await api.get('/api/v1/auth/me');
    assert.equal(res.status, 401);
  });

  it('sends the Content-Security-Policy on API answers, not on the API docs page', async () => {
    const answer = await api.get('/api/v1/health');
    assert.match(answer.headers['content-security-policy'] ?? '', /default-src 'self'/);
    assert.equal(answer.headers['x-content-type-options'], 'nosniff');

    const docs = await api.get('/api/docs/');
    assert.equal(docs.status, 200);
    assert.equal(docs.headers['content-security-policy'], undefined);
    assert.equal(docs.headers['x-content-type-options'], 'nosniff');
  });
});
