/**
 * Shared test harness: the app under test (supertest), account factories and
 * small builders for classes, subjects and assignments. Import AFTER ./setup.js.
 */
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { run } from '../../src/config/db.js';
import { createUserAccount } from '../../src/modules/users/users.service.js';
import { currentAcademicYear, todayYmd } from '../../src/utils/dates.js';
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

/**
 * A count as letters, for unique names (a name takes no digits): 1 -> 'A', 26 -> 'Z', 27 -> 'AA', 28 -> 'AB'.
 * @param {number} count 1 or more
 */
export function lettersOf(count) {
  let rest = count;
  let letters = '';
  while (rest > 0) {
    rest -= 1;
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  }
  return letters;
}

/**
 * Creates an account of any role but `assistant` (see makeAssistant) and returns it with a ready-to-use
 * Authorization header.
 */
export function makeUser(role, overrides = {}) {
  if (role === 'assistant')
    throw new Error('use makeAssistant(): a student assistant needs an approved request');
  return makeAccount(role, overrides);
}

/**
 * A student assistant the school office has approved. Every assistant is created with a pending sign-up
 * request (only POST /auth/register creates them through the API); the request is approved here directly.
 */
export async function makeAssistant(overrides = {}) {
  const account = await makeAccount('assistant', overrides);
  await run(
    "UPDATE assistant_requests SET status = 'approved', decided_at = UTC_TIMESTAMP() WHERE user_id = ?",
    [account.id],
  );
  return { ...account, assistantRequest: { ...account.assistantRequest, status: 'approved' } };
}

/**
 * Puts `count` new students in the class (active enrollments from today), for head counts. The students are
 * written straight to the database, without a sign-in or an application; returns their student ids.
 */
export async function fillClass(classId, count) {
  const studentIds = [];
  for (let i = 0; i < count; i += 1) {
    sequence += 1;
    const { insertId: userId } = await run(
      "INSERT INTO users (firebase_uid, email, first_name, last_name, role) VALUES (?, ?, 'Seat', ?, 'student')",
      [`seat-${sequence}`, `seat${sequence}@school.test`, `Holder${sequence}`],
    );
    const { insertId } = await run(
      'INSERT INTO students (user_id, student_number, admission_date) VALUES (?, ?, ?)',
      [userId, `STU-1999-${String(sequence).padStart(4, '0')}`, todayYmd()],
    );
    studentIds.push(insertId);
  }
  await run('INSERT INTO enrollments (student_id, class_id, status, enrolled_on) VALUES ?', [
    studentIds.map((studentId) => [studentId, classId, 'active', todayYmd()]),
  ]);
  return studentIds;
}

async function makeAccount(role, overrides) {
  sequence += 1;
  const account = await createUserAccount(
    {
      email: `${role}${sequence}@school.test`,
      password: 'Password123!',
      role,
      firstName: `First${lettersOf(sequence)}`,
      lastName: `Last${lettersOf(sequence)}`,
      // Students and teachers have a profile; admins and assistants have none.
      ...(role === 'student' || role === 'teacher' ? { profile: {} } : {}),
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
