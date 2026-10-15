import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

// This file runs in its own process, so it can name the demo account before the app loads. Mixed case on
// purpose: emails are stored in lower case and the variable is matched the same way.
process.env.DEMO_ACCOUNT_EMAIL = 'Demo.Admin@school.test';
const { DEMO_SIGN_IN_LIMIT } = await import('../src/modules/auth/auth.routes.js');
const { api, as, closeWorld, makeUser, resetWorld } = await import('./helpers/harness.js');

after(closeWorld);

let demoPosts = 0;
const postDemo = () => {
  demoPosts += 1;
  return api.post('/api/v1/auth/demo');
};

const assertDemoDisabled = (res) => {
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.error.details.reason, 'demo_disabled');
};

describe('one-tap demo sign-in (DEMO_ACCOUNT_EMAIL)', () => {
  let demo;
  let admin;

  before(resetWorld);

  it('offers nothing while the named account does not exist', async () => {
    assertDemoDisabled(await api.get('/api/v1/auth/demo'));
    assertDemoDisabled(await postDemo());
  });

  it('names the demo account without a token, and nothing else about it', async () => {
    demo = await makeUser('admin', {
      email: 'demo.admin@school.test',
      firstName: 'Plue',
      lastName: 'Truslow',
    });
    admin = await makeUser('admin');

    const res = await api.get('/api/v1/auth/demo');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { firstName: 'Plue', lastName: 'Truslow', role: 'admin' });
  });

  it('hands out a custom token for the demo account only', async () => {
    const res = await postDemo();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { customToken: `custom-${demo.firebaseUid}` });
  });

  it('marks the demo account, and only it, with isDemo', async () => {
    const me = await api.get('/api/v1/auth/me').set(as(demo));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.isDemo, true);

    const other = await api.get('/api/v1/auth/me').set(as(admin));
    assert.equal(other.body.data.isDemo, false);

    const seenByAdmin = await api.get(`/api/v1/users/${demo.id}`).set(as(admin));
    assert.equal(seenByAdmin.body.data.isDemo, true);
  });

  it('is a full account of its role', async () => {
    const res = await api.get('/api/v1/users').set(as(demo));
    assert.equal(res.status, 200);
  });

  it('offers nothing while the demo account is deactivated', async () => {
    const off = await api.patch(`/api/v1/users/${demo.id}/status`).set(as(admin)).send({ isActive: false });
    assert.equal(off.status, 200);
    assertDemoDisabled(await api.get('/api/v1/auth/demo'));
    assertDemoDisabled(await postDemo());

    const on = await api.patch(`/api/v1/users/${demo.id}/status`).set(as(admin)).send({ isActive: true });
    assert.equal(on.status, 200);
    assert.equal((await api.get('/api/v1/auth/demo')).status, 200);
  });

  it(`limits sign-ins to ${DEMO_SIGN_IN_LIMIT} per IP address`, async () => {
    while (demoPosts < DEMO_SIGN_IN_LIMIT) assert.equal((await postDemo()).status, 200);
    const res = await postDemo();
    assert.equal(res.status, 429);
    assert.equal(res.body.error.code, 'RATE_LIMITED');
    assert.ok(Number(res.headers['retry-after']) > 0);
  });
});
