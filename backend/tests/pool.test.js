// A pool of two connections makes the burst below far bigger than the pool, as a class signing in at once
// is for the hosted API's ten. Set before setup.js, which loads config/env.js.
process.env.DB_CONNECTION_LIMIT = '2';
import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

describe('connection pool under a burst of dashboard loads', () => {
  let school;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  // One dashboard load runs a dozen queries side by side. Thirty at once queue several hundred queries
  // behind two connections: they wait their turn instead of being turned away as 503 "database busy".
  it('answers every load once a connection is free', async () => {
    const { admin, owner, s1 } = school;
    const callers = Array.from({ length: 30 }, (_, i) => [admin, owner, s1][i % 3]);
    const responses = await Promise.all(callers.map((who) => api.get('/api/v1/dashboard').set(as(who))));
    const statuses = responses.map((res) => res.status);
    assert.deepEqual(
      statuses.filter((status) => status !== 200),
      [],
      `non-200 answers: ${JSON.stringify(responses.find((res) => res.status !== 200)?.body)}`,
    );
  });
});
