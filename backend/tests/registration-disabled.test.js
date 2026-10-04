import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

// setup.js enables registration; this file runs in its own process, so it can switch it off before the app loads.
process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
const { api, closeWorld } = await import('./helpers/harness.js');

after(closeWorld);

describe('registration disabled (ALLOW_PUBLIC_REGISTRATION=false)', () => {
  it('answers 404 with details.reason registration_disabled', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ email: 'nia@school.test', password: 'Password123!', firstName: 'Nia', lastName: 'Okoye' });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.equal(res.body.error.details.reason, 'registration_disabled');
  });
});
