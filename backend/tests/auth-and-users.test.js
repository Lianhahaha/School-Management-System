import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { pool, query } from '../src/config/db.js';
import { firebase } from '../src/config/firebase.js';
import { REGISTER_FAILED_LIMIT } from '../src/modules/auth/auth.routes.js';
import { logger } from '../src/utils/logger.js';
import { FAKE_PROJECT_ID, bearer, firebaseUsers } from './helpers/fakeFirebase.js';
import { currentAcademicYear } from '../src/utils/dates.js';
import {
  api,
  as,
  assignTeacher,
  closeWorld,
  enrollStudent,
  makeClass,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';
import { openSession, waitForLockWaits } from './helpers/locks.js';

after(closeWorld); // once per file: every suite shares the pool

const firebaseError = (code, message) => Object.assign(new Error(message), { code });

describe('health, 404 and authentication middleware', () => {
  before(resetWorld);

  it('GET /health is public and reports the database and the Firebase project', async () => {
    const res = await api.get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.db, 'up');
    assert.equal(res.body.data.firebaseProjectId, FAKE_PROJECT_ID);
    assert.ok(res.headers['x-request-id']);
  });

  it('GET /health answers 503 and logs why the database ping failed', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:3306');
    });
    const logged = mock.method(logger, 'error', () => {});
    try {
      const res = await api.get('/api/v1/health');
      assert.equal(res.status, 503);
      assert.equal(res.body.error.details.component, 'db');
      assert.equal(logged.mock.calls[0].arguments[1].cause, 'connect ECONNREFUSED 127.0.0.1:3306');
    } finally {
      mock.restoreAll();
    }
  });

  it('serves the OpenAPI document without a token', async () => {
    const res = await api.get('/api/docs/openapi.json');
    assert.equal(res.status, 200);
    assert.match(res.body.openapi, /^3\.0\./);
    assert.ok(res.body.paths['/users/{id}'].delete);
  });

  it('answers 400, not 500, for a body the parser refuses (unsupported charset)', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{"email":"x@school.test"}');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details.reason, 'charset.unsupported');
  });

  it('answers 404 for an unknown route whether or not a token is sent', async () => {
    const outside = await api.get('/nowhere');
    assert.equal(outside.status, 404);
    assert.equal(outside.body.error.code, 'NOT_FOUND');
    const anonymous = await api.get('/api/v1/nope');
    assert.equal(anonymous.status, 404);
    assert.equal(anonymous.body.error.code, 'NOT_FOUND');
    assert.equal((await api.get('/api/v1/nope').set('Authorization', 'Bearer token-ghost')).status, 404);
    const admin = await makeUser('admin');
    assert.equal((await api.get('/api/v1/nope').set(as(admin))).status, 404);
    assert.equal((await api.get('/api/v1/students')).status, 401);
  });

  it('rejects a missing token with 401 UNAUTHORIZED', async () => {
    const res = await api.get('/api/v1/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('reads the Bearer scheme in any case, and refuses a header with more than one token', async () => {
    const admin = await makeUser('admin');
    const token = admin.auth.replace(/^Bearer /, '');
    assert.equal((await api.get('/api/v1/auth/me').set('Authorization', `bearer ${token}`)).status, 200);
    const extra = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${token} other`);
    assert.equal(extra.status, 401);
    assert.equal(extra.body.error.details.reason, 'missing_token');
  });

  it('rejects a token Firebase does not know with 401 UNAUTHORIZED', async () => {
    const res = await api.get('/api/v1/auth/me').set('Authorization', 'Bearer token-ghost');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.details.reason, 'auth/argument-error');
  });

  it('answers 503 SERVICE_UNAVAILABLE, not 401, when the token cannot be checked at all', async () => {
    const failures = [
      // firebase-admin reports a failed download of Google's signing keys with the malformed-token code.
      firebaseError(
        'auth/argument-error',
        'Error fetching public keys for Google certs: Service Unavailable',
      ),
      firebaseError(
        'auth/argument-error',
        'Error while making request: getaddrinfo ENOTFOUND www.googleapis.com. Error code: ENOTFOUND',
      ),
      firebaseError('ENOTFOUND', 'getaddrinfo ENOTFOUND www.googleapis.com'),
    ];
    const logged = mock.method(logger, 'error', () => {});
    const verify = mock.method(firebase, 'verifyIdToken');
    try {
      for (const failure of failures) {
        verify.mock.mockImplementation(async () => {
          throw failure;
        });
        const res = await api.get('/api/v1/auth/me').set('Authorization', 'Bearer any-token');
        assert.equal(res.status, 503, failure.message);
        assert.equal(res.body.error.code, 'SERVICE_UNAVAILABLE');
        assert.equal(res.body.error.details.component, 'auth');
        assert.equal(logged.mock.calls.at(-1).arguments[1].cause, failure.message);
      }
    } finally {
      mock.restoreAll();
    }
  });

  it('answers 403 USER_NOT_REGISTERED for a valid Firebase user without a MySQL row', async () => {
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

  it('capitalises a name typed all in lower case and keeps any other casing', async () => {
    const res = await api.post('/api/v1/auth/register').send({
      ...body,
      email: 'lower.case@school.test',
      firstName: "mary-jo o'brien",
      lastName: 'dela Cruz',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.firstName, "Mary-Jo O'Brien");
    assert.equal(res.body.data.lastName, 'dela Cruz');
  });

  it('keeps an LRN given at sign-up, and refuses one that already belongs to a student with 409', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'with.lrn@school.test', lrn: '136512140009' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.profile.lrn, '136512140009');
    const taken = await api
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'same.lrn@school.test', lrn: '136512140009' });
    assert.equal(taken.status, 409);
    assert.equal(taken.body.error.details.key, 'students.uq_students_lrn');
    assert.equal(
      firebaseUsers().some((user) => user.email === 'same.lrn@school.test'),
      false,
      'the refused sign-up leaves no Firebase user behind',
    );
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

  it('never adopts an orphaned Firebase user, and answers it exactly like a registered email', async () => {
    await firebase.createUser({ email: 'orphan2@school.test', password: 'Password123!' });
    const orphan = await api.post('/api/v1/auth/register').send({ ...body, email: 'orphan2@school.test' });
    const registered = await api.post('/api/v1/auth/register').send(body);
    assert.equal(orphan.status, 409);
    assert.equal(orphan.body.error.details.reason, 'email_in_use');
    assert.deepEqual(orphan.body.error, registered.body.error);
  });

  it('rejects a short password and a missing body with 400', async () => {
    const short = await api
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'y@school.test', password: 'short' });
    assert.equal(short.status, 400);
    const none = await api.post('/api/v1/auth/register');
    assert.equal(none.status, 400);
  });

  it('counts only successful registrations against the limit of 30 per 15 minutes per IP', async () => {
    for (let attempt = 1; attempt <= 35; attempt += 1) {
      const rejected = await api
        .post('/api/v1/auth/register')
        .send({ ...body, email: `lab${attempt}@school.test`, password: 'short' });
      assert.equal(rejected.status, 400, `attempt ${attempt}`);
    }
    const res = await api.post('/api/v1/auth/register').send({ ...body, email: 'lab.ok@school.test' });
    assert.equal(res.status, 201);
    assert.equal(res.headers['ratelimit-limit'], '30');
  });

  it(`stops an IP after ${REGISTER_FAILED_LIMIT} rejected attempts (no unlimited email probing)`, async () => {
    let status;
    for (let attempt = 1; attempt <= REGISTER_FAILED_LIMIT + 1 && status !== 429; attempt += 1) {
      status = (await api.post('/api/v1/auth/register').send(body)).status;
    }
    assert.equal(status, 429);
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

  it('replaces a Firebase user that has no school account instead of adopting it (no takeover)', async () => {
    const admin = await makeUser('admin');
    const squatter = await firebase.createUser({ email: 'squat@school.test', password: 'attacker-pass' });
    const res = await api.post('/api/v1/users').set(as(admin)).send({
      role: 'admin',
      email: 'squat@school.test',
      password: 'Password123!',
      firstName: 'Sam',
      lastName: 'Ortiz',
    });
    assert.equal(res.status, 201);
    assert.notEqual(res.body.data.firebaseUid, squatter.uid);
    assert.deepEqual(
      firebaseUsers()
        .filter((user) => user.email === 'squat@school.test')
        .map((user) => user.uid),
      [res.body.data.firebaseUid],
    );
    const stolen = await api.get('/api/v1/auth/me').set('Authorization', bearer(squatter.uid));
    assert.equal(stolen.status, 401);
  });

  it('leaves no Firebase user behind when the account replacing a stray one fails to insert', async () => {
    const admin = await makeUser('admin');
    await makeUser('teacher', { profile: { employeeNumber: 'EMP-2026-8888' } });
    await firebase.createUser({ email: 'stray@school.test', password: 'whatever1' });
    const res = await api
      .post('/api/v1/users')
      .set(as(admin))
      .send({
        role: 'teacher',
        email: 'stray@school.test',
        password: 'Password123!',
        firstName: 'Stray',
        lastName: 'Account',
        profile: { employeeNumber: 'EMP-2026-8888' },
      });
    assert.equal(res.status, 409);
    assert.equal(
      firebaseUsers().some((user) => user.email === 'stray@school.test'),
      false,
    );
  });

  it('never replaces a Firebase user that is linked to another account (email changed in Firebase)', async () => {
    const admin = await makeUser('admin');
    const moved = await makeUser('teacher');
    await firebase.updateUser(moved.firebaseUid, { email: 'moved@school.test' });
    const res = await api.post('/api/v1/users').set(as(admin)).send({
      role: 'admin',
      email: 'moved@school.test',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'Person',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'email_in_use');
    assert.ok(firebaseUsers().some((user) => user.uid === moved.firebaseUid));
  });

  it('refuses to deactivate a teacher who has classes in a later academic year', async () => {
    const admin = await makeUser('admin');
    const teacher = await makeUser('teacher');
    const firstYear = Number(currentAcademicYear().slice(0, 4));
    await assignTeacher(admin, {
      classId: (await makeClass(admin, { academicYear: `${firstYear + 1}-${firstYear + 2}` })).id,
      subjectId: (await makeSubject(admin)).id,
      teacherId: teacher.teacherId,
    });
    const res = await api
      .patch(`/api/v1/users/${teacher.id}/status`)
      .set(as(admin))
      .send({ isActive: false });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'teacher_has_assignments');
  });

  it('keeps the audit entry when Firebase fails during a deactivation, and a retry finishes the job', async () => {
    const admin = await makeUser('admin');
    const student = await makeUser('student');
    const realUpdate = firebase.updateUser;
    firebase.updateUser = async () => {
      throw firebaseError('app/network-error', 'network down');
    };
    let res;
    try {
      res = await api.patch(`/api/v1/users/${student.id}/status`).set(as(admin)).send({ isActive: false });
    } finally {
      firebase.updateUser = realUpdate;
    }
    assert.equal(res.status, 503);
    const logged = await query(
      "SELECT COUNT(*) AS n FROM activity_log WHERE action = 'user.deactivate' AND entity_id = ?",
      [student.id],
    );
    assert.equal(logged[0].n, 1);

    const retry = await api
      .patch(`/api/v1/users/${student.id}/status`)
      .set(as(admin))
      .send({ isActive: false });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.isActive, false);
    assert.equal(firebaseUsers().find((user) => user.uid === student.firebaseUid).disabled, true);
  });

  it('refuses to change your own status (403 self_status_change)', async () => {
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

  it('finds an account by its full name', async () => {
    const admin = await makeUser('admin');
    const liam = await makeUser('teacher', { firstName: 'Liam', lastName: 'Cruz' });
    await makeUser('teacher', { firstName: 'Liam', lastName: 'Walker' });
    const res = await api.get('/api/v1/users?search=Liam%20Cruz').set(as(admin));
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((user) => user.id),
      [liam.id],
    );
  });
});

describe('account deletion', () => {
  let admin;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
  });

  const remove = (user, actor = admin) => api.delete(`/api/v1/users/${user.id}`).set(as(actor));

  it('deletes an unused account of any role; the email can then be used again', async () => {
    for (const role of ['student', 'teacher', 'admin']) {
      const user = await makeUser(role);
      const res = await remove(user);
      assert.equal(res.status, 200, role);
      assert.deepEqual(res.body.data, { id: user.id });
      assert.equal((await api.get(`/api/v1/users/${user.id}`).set(as(admin))).status, 404);
      if (user.studentId) {
        assert.equal((await api.get(`/api/v1/students/${user.studentId}`).set(as(admin))).status, 404);
      }
      if (user.teacherId) {
        assert.equal((await api.get(`/api/v1/teachers/${user.teacherId}`).set(as(admin))).status, 404);
      }
      assert.equal(
        firebaseUsers().some((entry) => entry.uid === user.firebaseUid),
        false,
      );
      const again = await api
        .post('/api/v1/users')
        .set(as(admin))
        .send({ role, email: user.email, password: 'Password123!', firstName: 'New', lastName: 'Person' });
      assert.equal(again.status, 201);
    }
  });

  it('refuses to delete your own account (403 self)', async () => {
    const res = await remove(admin);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.details.reason, 'self');
  });

  it('refuses an account with school records (409 has_history) and keeps it', async () => {
    const student = await makeUser('student');
    const teacher = await makeUser('teacher');
    const author = await makeUser('admin');
    const homeroom = await makeClass(admin, { homeroomTeacherId: teacher.teacherId });
    await enrollStudent(admin, { studentId: student.studentId, classId: homeroom.id });
    const announcement = await api
      .post('/api/v1/announcements')
      .set(as(author))
      .send({ title: 'Welcome', body: 'b', audience: 'all' });
    assert.equal(announcement.status, 201);

    for (const user of [student, teacher, author]) {
      const res = await remove(user);
      assert.equal(res.status, 409, user.role);
      assert.equal(res.body.error.details.reason, 'has_history');
      assert.equal((await api.get(`/api/v1/users/${user.id}`).set(as(admin))).status, 200);
      assert.ok(firebaseUsers().some((entry) => entry.uid === user.firebaseUid));
    }
  });

  it('maps a record added while the delete runs (FK RESTRICT) to the same 409 has_history', async () => {
    const student = await makeUser('student');
    const classRow = await makeClass(admin);
    const session = await openSession();
    try {
      await session.beginTransaction();
      await session.query(
        'INSERT INTO enrollments (student_id, class_id, enrolled_on) VALUES (?, ?, CURDATE())',
        [student.studentId, classRow.id],
      );
      const pending = remove(student).then((res) => res);
      await waitForLockWaits(1);
      await session.commit();
      const res = await pending;
      assert.equal(res.status, 409);
      assert.equal(res.body.error.details.reason, 'has_history');
    } finally {
      await session.end();
    }
  });

  it('is admin only, needs a token and answers 404 for an unknown id', async () => {
    const teacher = await makeUser('teacher');
    const target = await makeUser('student');
    const forbidden = await remove(target, teacher);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.details.reason, 'role_not_allowed');
    assert.equal((await api.delete(`/api/v1/users/${target.id}`)).status, 401);
    assert.equal((await api.delete('/api/v1/users/999999').set(as(admin))).status, 404);
  });
});

describe('last active admin', () => {
  beforeEach(resetWorld);

  const activeAdmins = async () =>
    (await query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1"))[0].n;
  const deactivate = (target, actor) =>
    api.patch(`/api/v1/users/${target.id}/status`).set(as(actor)).send({ isActive: false });

  /** Sends `requests` while another session holds the admins' rows, so they all reach the lock together. */
  async function race(admins, requests) {
    const session = await openSession();
    try {
      await session.beginTransaction();
      await session.query('SELECT id FROM users WHERE id IN (?) FOR UPDATE', [admins.map((user) => user.id)]);
      const pending = Promise.all(requests);
      await waitForLockWaits(requests.length);
      await session.commit();
      return await pending;
    } finally {
      await session.end();
    }
  }

  it('lets only one of two admins deactivating each other succeed (409 last_admin)', async () => {
    const [first, second] = [await makeUser('admin'), await makeUser('admin')];
    const responses = await race([first, second], [deactivate(second, first), deactivate(first, second)]);
    assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
    assert.equal(responses.find((res) => res.status === 409).body.error.details.reason, 'last_admin');
    assert.equal(await activeAdmins(), 1);
  });

  it('applies the same rule when one admin deletes the other while being deactivated', async () => {
    const [first, second] = [await makeUser('admin'), await makeUser('admin')];
    const responses = await race(
      [first, second],
      [api.delete(`/api/v1/users/${second.id}`).set(as(first)), deactivate(first, second)],
    );
    const refused = responses.filter((res) => res.status === 409);
    assert.equal(refused.length, 1, JSON.stringify(responses.map((res) => res.status)));
    assert.equal(refused[0].body.error.details.reason, 'last_admin');
    assert.equal(await activeAdmins(), 1);
  });
});
