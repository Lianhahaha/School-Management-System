import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { query } from '../src/config/db.js';
import { seed } from '../scripts/seed.js';
import { api, closeWorld, resetWorld } from './helpers/harness.js';
import { prepareDatabase } from './helpers/db.js';
import { bearer, firebaseUsers, installFakeFirebase } from './helpers/fakeFirebase.js';

after(closeWorld);

const COUNTED_TABLES = [
  'users',
  'teachers',
  'students',
  'subjects',
  'classes',
  'class_subjects',
  'enrollments',
  'schedules',
  'attendance',
  'assessments',
  'grades',
  'announcements',
];

async function counts() {
  const entries = await Promise.all(
    COUNTED_TABLES.map(async (table) => [table, (await query(`SELECT COUNT(*) AS n FROM ${table}`))[0].n]),
  );
  return Object.fromEntries(entries);
}

describe('seed', () => {
  before(async () => {
    await resetWorld();
    mock.method(console, 'log', () => {});
  });
  after(() => mock.restoreAll());

  it('creates the 13 accounts and the whole demo school', async () => {
    await seed();
    const total = await counts();
    assert.equal(total.users, 13);
    assert.equal(total.teachers, 3);
    assert.equal(total.students, 8);
    assert.equal(total.subjects, 5);
    assert.equal(total.classes, 2);
    assert.equal(total.class_subjects, 10);
    assert.equal(total.enrollments, 9);
    assert.equal(total.schedules, 30);
    assert.equal(total.assessments, 2);
    assert.equal(total.grades, 8);
    assert.equal(total.announcements, 3);
    assert.ok(total.attendance > 0);
    assert.equal(firebaseUsers().length, 13);
  });

  it('produces accounts that work through the API', async () => {
    const [admin] = await query("SELECT firebase_uid FROM users WHERE email = 'admin@school.test'");
    const res = await api.get('/api/v1/dashboard').set({ Authorization: bearer(admin.firebaseUid) });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.counts.students, 8);
    assert.equal(res.body.data.counts.classes, 2);
    assert.equal(res.body.data.counts.unenrolledStudents, 0);

    const [student] = await query("SELECT firebase_uid FROM users WHERE email = 'student1@school.test'");
    const mine = await api.get('/api/v1/grades').set({ Authorization: bearer(student.firebaseUid) });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.meta.total, 1);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const snapshot = await counts();
    const uids = await query('SELECT id, firebase_uid FROM users ORDER BY id');
    await seed();
    assert.deepEqual(await counts(), snapshot);
    assert.deepEqual(await query('SELECT id, firebase_uid FROM users ORDER BY id'), uids);
    assert.equal(firebaseUsers().length, 13);
  });

  it('links the existing Firebase users when seeding a second, empty database (shared project)', async () => {
    const before = new Map(firebaseUsers().map((user) => [user.email, user.uid]));
    await prepareDatabase(); // a new database; the Firebase project already has the demo users
    await seed();
    assert.equal(firebaseUsers().length, 13);
    const rows = await query('SELECT email, firebase_uid FROM users');
    assert.equal(rows.length, 13);
    assert.ok(rows.every((row) => before.get(row.email) === row.firebaseUid));
  });

  it('re-links accounts to a fresh Firebase project instead of failing', async () => {
    installFakeFirebase(); // an empty Firebase project: MySQL rows exist, Firebase users do not
    await seed();
    assert.equal(firebaseUsers().length, 13);
    const rows = await query('SELECT firebase_uid FROM users');
    const known = new Set(firebaseUsers().map((user) => user.uid));
    assert.ok(rows.every((row) => known.has(row.firebaseUid)));
  });
});
