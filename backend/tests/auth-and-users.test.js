import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { bearer, firebaseUsers } from './helpers/fakeFirebase.js';
import { api, as, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld); // once per file: every suite shares the pool

describe('health, 404 and authentication middleware', () => {
  before(resetWorld);

  it('GET /health is public and reports the database', async () => {
    const res = await api.get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.db, 'up');
    assert.ok(res.headers['x-request-id']);
  });

  it('unknown routes answer with the 404 envelope (401 first for anonymous API callers)', async () => {
    const outside = await api.get('/nowhere');
    assert.equal(outside.status, 404);
    assert.equal(outside.body.error.code, 'NOT_FOUND');
    assert.equal((await api.get('/api/v1/nope')).status, 401);
    const admin = await makeUser('admin');
    const res = await api.get('/api/v1/nope').set(as(admin));
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('rejects a missing token with 401 UNAUTHORIZED', async () => {
    const res = await api.get('/api/v1/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects a token Firebase does not know with 401 UNAUTHORIZED', async () => {
    const res = await api.get('/api/v1/auth/me').set('Authorization', 'Bearer token-ghost');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.details.reason, 'auth/argument-error');
  });

  it('answers 403 USER_NOT_REGISTERED for a valid Firebase user without a MySQL row', async () => {
    const { firebase } = await import('../src/config/firebase.js');
    const { uid } = await firebase.createUser({ email: 'orphan@school.test', password: 'Password123!' });
    const res = await api.get('/api/v1/auth/me').set('Authorization', bearer(uid));
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'USER_NOT_REGISTERED');
  });

  it('answers 403 ACCOUNT_DISABLED for a deactivated user on the very next request', async () => {
    const admin = await makeUser('admin');
    const teacher = await makeUser('teacher');
    assert.equal((await api.get('/api/v1/auth/me').set(as(teacher))).status, 200);
    const res = await api
      .patch(`/api/v1/users/${teacher.id}/status`)
      .set(as(admin))
      .send({ isActive: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isActive, false);
    const after = await api.get('/api/v1/auth/me').set(as(teacher));
    assert.equal(after.status, 403);
    assert.equal(after.body.error.code, 'ACCOUNT_DISABLED');
  });
});

describe('registration', () => {
  before(resetWorld);

  const body = {
    email: 'New.Student@School.test',
    password: 'Password123!',
    firstName: 'Nia',
    lastName: 'Okoye',
  };

  it('creates a student account, lower-cases the email and generates a student number', async () => {
    const res = await api.post('/api/v1/auth/register').send(body);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'student');
    assert.equal(res.body.data.email, 'new.student@school.test');
    assert.match(res.body.data.profile.studentNumber, /^STU-\d{4}-0001$/);
    assert.equal(res.body.data.currentEnrollment, null);
  });

  it('the new student can sign in and read /auth/me', async () => {
    const uid = firebaseUsers().find((user) => user.email === 'new.student@school.test').uid;
    const res = await api.get('/api/v1/auth/me').set('Authorization', bearer(uid));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.firstName, 'Nia');
  });

  it('refuses a `role` field (no privilege escalation) with 400', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'x@school.test', role: 'admin' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('answers 409 for an email that is already registered', async () => {
    const res = await api.post('/api/v1/auth/register').send(body);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.details.key, 'users.uq_users_email');
  });

  it('never adopts an orphaned Firebase user: 409 email_in_use', async () => {
    const { firebase } = await import('../src/config/firebase.js');
    await firebase.createUser({ email: 'orphan2@school.test', password: 'Password123!' });
    const res = await api.post('/api/v1/auth/register').send({ ...body, email: 'orphan2@school.test' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'email_in_use');
  });

  it('rejects a short password and a missing body with 400', async () => {
    const short = await api
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'y@school.test', password: 'short' });
    assert.equal(short.status, 400);
    const none = await api.post('/api/v1/auth/register');
    assert.equal(none.status, 400);
  });
});

describe('user administration', () => {
  before(resetWorld);

  it('an admin creates a teacher with a generated employee number', async () => {
    const admin = await makeUser('admin');
    const res = await api
      .post('/api/v1/users')
      .set(as(admin))
      .send({
        role: 'teacher',
        email: 'ana@school.test',
        password: 'Password123!',
        firstName: 'Ana',
        lastName: 'Reyes',
        profile: { department: 'Science' },
      });
    assert.equal(res.status, 201);
    assert.match(res.body.data.profile.employeeNumber, /^EMP-\d{4}-\d{4}$/);
    assert.equal(res.body.data.profile.department, 'Science');
  });

  it('students and teachers cannot use /users (403 FORBIDDEN)', async () => {
    const student = await makeUser('student');
    const teacher = await makeUser('teacher');
    for (const user of [student, teacher]) {
      const res = await api.get('/api/v1/users').set(as(user));
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
  });

  it('deletes the Firebase user again when the MySQL insert fails (no orphans)', async () => {
    const admin = await makeUser('admin');
    const payload = (email) => ({
      role: 'teacher',
      email,
      password: 'Password123!',
      firstName: 'Dup',
      lastName: 'Licate',
      profile: { employeeNumber: 'EMP-2026-9999' },
    });
    assert.equal(
      (await api.post('/api/v1/users').set(as(admin)).send(payload('first@school.test'))).status,
      201,
    );
    const second = await api.post('/api/v1/users').set(as(admin)).send(payload('second@school.test'));
    assert.equal(second.status, 409);
    assert.equal(
      firebaseUsers().some((user) => user.email === 'second@school.test'),
      false,
    );
  });

  it('an admin adopts an existing Firebase account instead of failing', async () => {
    const admin = await makeUser('admin');
    const { firebase } = await import('../src/config/firebase.js');
    const orphan = await firebase.createUser({ email: 'adopt@school.test', password: 'old-password' });
    const res = await api.post('/api/v1/users').set(as(admin)).send({
      role: 'admin',
      email: 'adopt@school.test',
      password: 'Password123!',
      firstName: 'Ad',
      lastName: 'Opt',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.firebaseUid, orphan.uid);
  });

  it('refuses to change your own status, which also protects the last active admin', async () => {
    const admin = await makeUser('admin');
    const self = await api.patch(`/api/v1/users/${admin.id}/status`).set(as(admin)).send({ isActive: false });
    assert.equal(self.status, 403);
    assert.equal(self.body.error.details.reason, 'self_status_change');

    const other = await makeUser('admin');
    const ok = await api.patch(`/api/v1/users/${other.id}/status`).set(as(admin)).send({ isActive: false });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.isActive, false);
  });

  it('lists users with search, filters, pagination meta and validated sorting', async () => {
    const admin = await makeUser('admin');
    const res = await api.get('/api/v1/users?role=teacher&limit=1&sortBy=lastName').set(as(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.ok(res.body.meta.total >= 1);
    assert.equal((await api.get('/api/v1/users?sortBy=password').set(as(admin))).status, 400);
    assert.equal((await api.get('/api/v1/users?limit=1000').set(as(admin))).status, 400);
    assert.equal((await api.get('/api/v1/users?search=%25').set(as(admin))).body.meta.total, 0);
  });
});
