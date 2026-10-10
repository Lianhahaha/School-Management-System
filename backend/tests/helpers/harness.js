/**
 * Shared test harness: the app under test (supertest), account factories and
 * small builders for classes, subjects and assignments. Import AFTER ./setup.js.
 */
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createUserAccount } from '../../src/modules/users/users.service.js';
import { currentAcademicYear } from '../../src/utils/dates.js';
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

/** The fields POST /auth/register requires besides the account ones: the guardian and the grade applied for. */
export const APPLICATION_FIELDS = Object.freeze({
  gradeLevel: 7,
  guardianName: 'Maria Cruz',
  guardianPhone: '+63 917 765 4321',
});

export const as = (user) => ({ Authorization: user.auth });

/** Creates a class through the API as `admin` and returns its body data. */
export async function makeClass(admin, overrides = {}) {
  sequence += 1;
  const res = await api
    .post('/api/v1/classes')
    .set(as(admin))
    .send({
      name: `Grade 10 - ${sequence}`,
      gradeLevel: 10,
      academicYear: currentAcademicYear(),
      ...overrides,
    });
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

/**
 * A small school for the operational suites: one admin, two teachers, three students and two classes.
 * `owner` is homeroom teacher of classA and teaches csA; `other` teaches csB and has no link to classA.
 * s1 and s2 are enrolled in classA; s3 is not enrolled anywhere.
 */
export async function buildSchool() {
  const admin = await makeUser('admin');
  const [owner, other] = [await makeUser('teacher'), await makeUser('teacher')];
  const [s1, s2, s3] = [await makeUser('student'), await makeUser('student'), await makeUser('student')];
  const classA = await makeClass(admin, { homeroomTeacherId: owner.teacherId });
  const classB = await makeClass(admin);
  const csA = await assignTeacher(admin, {
    classId: classA.id,
    subjectId: (await makeSubject(admin)).id,
    teacherId: owner.teacherId,
  });
  const csB = await assignTeacher(admin, {
    classId: classB.id,
    subjectId: (await makeSubject(admin)).id,
    teacherId: other.teacherId,
  });
  await enrollStudent(admin, { studentId: s1.studentId, classId: classA.id });
  await enrollStudent(admin, { studentId: s2.studentId, classId: classA.id });
  return { admin, owner, other, s1, s2, s3, classA, classB, csA, csB };
}
