/**
 * Shared test harness: the app under test (supertest), account factories and
 * small builders for classes, subjects and assignments. Import AFTER ./setup.js.
 */
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createUserAccount } from '../../src/modules/users/users.service.js';
import { bearer, installFakeFirebase } from './fakeFirebase.js';
import { prepareDatabase, shutdown } from './db.js';

export const app = createApp();
export const api = request(app);

/** Fresh database and fresh fake Firebase; call in `before`. */
export async function resetWorld() {
  await prepareDatabase();
  installFakeFirebase();
}

export const closeWorld = shutdown;

let sequence = 0;

/** Creates an account of any role and returns it with a ready-to-use Authorization header. */
export async function makeUser(role, overrides = {}) {
  sequence += 1;
  const account = await createUserAccount(
    {
      email: `${role}${sequence}@school.test`,
      password: 'Password123!',
      role,
      firstName: `First${sequence}`,
      lastName: `Last${sequence}`,
      ...(role === 'admin' ? {} : { profile: {} }),
      ...overrides,
    },
    { trusted: true },
  );
  return { ...account, auth: bearer(account.firebaseUid) };
}

export const as = (user) => ({ Authorization: user.auth });

/** Creates a class through the API as `admin` and returns its body data. */
export async function makeClass(admin, overrides = {}) {
  sequence += 1;
  const res = await api
    .post('/api/v1/classes')
    .set(as(admin))
    .send({ name: `Grade 10 - ${sequence}`, gradeLevel: 10, academicYear: '2026-2027', ...overrides });
  if (res.status !== 201) throw new Error(`makeClass failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function makeSubject(admin, overrides = {}) {
  sequence += 1;
  const res = await api
    .post('/api/v1/subjects')
    .set(as(admin))
    .send({ code: `SUBJ${sequence}`, name: `Subject ${sequence}`, ...overrides });
  if (res.status !== 201) throw new Error(`makeSubject failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function assignTeacher(admin, { classId, subjectId, teacherId }) {
  const res = await api.post('/api/v1/class-subjects').set(as(admin)).send({ classId, subjectId, teacherId });
  if (res.status !== 201) throw new Error(`assignTeacher failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function enrollStudent(admin, { studentId, classId }) {
  const res = await api.post('/api/v1/enrollments').set(as(admin)).send({ studentId, classId });
  if (res.status !== 201) throw new Error(`enrollStudent failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}
