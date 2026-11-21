import './helpers/setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dbErrorHint } from '../src/config/dbConnection.js';

// The hint is what a failed connection prints (the server at start-up, scripts/doctor.js, backup and restore).
// It must fix the right cause: the local MySQL80 service on this machine, the provider's console for a hosted one.
describe('database connection hints', () => {
  const refused = { code: 'ECONNREFUSED' };
  const timedOut = { code: 'ETIMEDOUT' };

  it('tells a local setup to start MySQL80', () => {
    const hint = dbErrorHint(refused, '127.0.0.1');
    assert.match(hint, /MySQL80/);
    assert.doesNotMatch(hint, /provider/);
  });

  it('tells a hosted setup to look in the provider console, not for MySQL80', () => {
    const hint = dbErrorHint(timedOut, 'mysql-1234.aivencloud.com');
    assert.match(hint, /provider/);
    assert.doesNotMatch(hint, /MySQL80/);
  });

  it('says nothing about the server for an error the code already explains', () => {
    assert.match(dbErrorHint({ code: 'ER_BAD_DB_ERROR' }, 'db.example.com'), /db:migrate/);
  });

  it('has no hint for an unknown code', () => {
    assert.equal(dbErrorHint({ code: 'ER_SOMETHING_NEW' }, 'db.example.com'), undefined);
  });
});
