import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query } from '../src/config/db.js';
import { NAME_REGEX } from '../src/constants/shared.js';
import { registerBody, updateMeBody } from '../src/modules/auth/auth.schemas.js';
import { APPLICATION_FIELDS, api, as, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

/**
 * What people really type: blanks, digits, emoji, other scripts, markup, SQL, template and path tricks, very long
 * text and characters nobody can see. Every one must come back as a clear answer (2xx or 4xx), never a 500.
 */
const CHAOS_TEXT = [
  '',
  ' ',
  '   \t\n ',
  '0',
  '-1',
  '12345',
  '3.14',
  '1e309',
  'NaN',
  'Infinity',
  'null',
  'undefined',
  'true',
  'Juan123',
  'Juan 😀',
  '😀😀',
  '<script>alert(1)</script>',
  "Robert'); DROP TABLE students;--",
  '" OR 1=1 --',
  '%',
  '_',
  '\\',
  '{{7*7}}',
  '${7*7}',
  '../../etc/passwd',
  'ñÑ áéíóú',
  'Zoë',
  '李小龙',
  'مرحبا',
  'Ma. Clara',
  "O'Brien-Dela Cruz",
  'Juan​Cruz',
  '‮Juan',
  'Juan\u0000Cruz',
  'a'.repeat(101),
  'a'.repeat(5000),
  'Ab'.repeat(30000),
];
/** The same, plus values of the wrong type entirely, as a hand-made request could send. */
const CHAOS_VALUES = [...CHAOS_TEXT, 0, -1, 1.5, 2 ** 53 + 2, true, false, null, [], ['x'], {}, { a: 1 }];

/** Characters nobody can see (controls other than a line break, zero-width and direction marks). */
const INVISIBLE = /[^\P{Cc}\n]|\p{Cf}/u;

const VALID_SIGN_UP = Object.freeze({
  email: 'chaos.base@school.test',
  password: 'Password123!',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  ...APPLICATION_FIELDS,
});

/** A 4xx answer has the API's error shape; anything else (2xx) is fine as it is; 5xx fails the test. */
function assertAnswered(res, label) {
  assert.ok(res.status < 500, `${label} -> ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
  if (res.status >= 400) {
    assert.equal(res.body?.success, false, `${label}: error body ${JSON.stringify(res.body).slice(0, 200)}`);
    assert.equal(typeof res.body.error?.code, 'string', `${label}: error code`);
  }
}

describe('chaotic input: every value gets a clear answer, never a crash', () => {
  let student;

  before(async () => {
    await resetWorld();
    student = await makeUser('student');
  });

  it('validates every sign-up field against every chaotic value without throwing', () => {
    const fields = [
      'firstName',
      'lastName',
      'guardianName',
      'email',
      'password',
      'phone',
      'guardianPhone',
      'gradeLevel',
      'lrn',
      'dateOfBirth',
      'gender',
      'address',
      'previousSchool',
      'accountType',
      'privacyNoticeVersion',
    ];
    for (const field of fields) {
      for (const value of CHAOS_VALUES) {
        const result = registerBody.safeParse({ ...VALID_SIGN_UP, [field]: value });
        if (!result.success) continue;
        const kept = result.data[field];
        // A password is kept exactly as typed: it is never shown, and changing it would lock its owner out.
        if (typeof kept !== 'string' || field === 'password') continue;
        assert.ok(!INVISIBLE.test(kept), `${field}=${JSON.stringify(value)} kept invisible characters`);
        if (['firstName', 'lastName', 'guardianName'].includes(field)) {
          assert.match(kept, NAME_REGEX, `${field}=${JSON.stringify(value)} accepted as a name`);
          assert.ok(kept.length <= 100);
        }
      }
    }
  });

  it('validates every profile field against every chaotic value without throwing', () => {
    for (const field of ['phone', 'address', 'guardianName', 'guardianPhone']) {
      for (const value of CHAOS_VALUES) {
        const result = updateMeBody.safeParse({ [field]: value });
        if (result.success && typeof result.data[field] === 'string') {
          assert.ok(!INVISIBLE.test(result.data[field]), `${field}=${JSON.stringify(value)}`);
        }
      }
    }
  });

  it('refuses names with digits, emoji, symbols or nothing in them, and saves nothing', async () => {
    const [{ before: usersBefore }] = await query('SELECT COUNT(*) AS `before` FROM users');
    for (const bad of ['12345', 'Juan123', 'Juan 😀', '<script>', '.Juan', '   ', '', 123, null, [], {}]) {
      const res = await api
        .post('/api/v1/auth/register')
        .send({ ...VALID_SIGN_UP, email: 'refused@school.test', firstName: bad });
      assertAnswered(res, `firstName ${JSON.stringify(bad)}`);
      assert.equal(res.status, 400, `firstName ${JSON.stringify(bad)} -> ${res.status}`);
    }
    const [{ after: usersAfter }] = await query('SELECT COUNT(*) AS `after` FROM users');
    assert.equal(usersAfter, usersBefore, 'a refused sign-up left an account behind');
  });

  it('keeps real names as typed, tidied: accents, other scripts, periods, apostrophes, hyphens', async () => {
    const cases = [
      ['Ma. Clara', 'Ma. Clara'],
      ["O'Brien-Dela Cruz", "O'Brien-Dela Cruz"],
      ['Zoë', 'Zoë'],
      ['李小龙', '李小龙'],
      ['  juan   dela cruz  ', 'Juan Dela Cruz'],
      ['Juan​Cruz', 'JuanCruz'],
    ];
    for (const [index, [typed, stored]] of cases.entries()) {
      const res = await api
        .post('/api/v1/auth/register')
        .send({ ...VALID_SIGN_UP, email: `name${index}@school.test`, firstName: typed });
      assertAnswered(res, `firstName ${JSON.stringify(typed)}`);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.data.firstName, stored);
    }
  });

  it('answers every chaotic profile edit with 200 or 400 and stores no invisible characters', async () => {
    for (const field of ['phone', 'address', 'guardianName', 'guardianPhone']) {
      for (const value of CHAOS_VALUES) {
        const res = await api
          .patch('/api/v1/auth/me')
          .set(as(student))
          .send({ [field]: value });
        assertAnswered(res, `PATCH /auth/me ${field}=${JSON.stringify(value).slice(0, 40)}`);
      }
    }
    const [row] = await query('SELECT address, guardian_name FROM students WHERE user_id = ?', [student.id]);
    assert.ok(!INVISIBLE.test(row.address ?? ''), 'address kept invisible characters');
    assert.ok(!INVISIBLE.test(row.guardian_name ?? ''), 'guardian name kept invisible characters');
  });

  it('answers chaotic filters, search boxes and page numbers on every list a student opens', async () => {
    const lists = [
      '/attendance?studentId=me',
      '/attendance/summary?studentId=me',
      '/grades?studentId=me',
      '/grades/summary?studentId=me',
      '/enrollments?studentId=me',
      '/announcements?',
      '/calendar-events?',
      '/notifications?',
      '/schedules?',
      '/dashboard?',
    ];
    const params = [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'search',
      'dateFrom',
      'dateTo',
      'academicYear',
      'semester',
      'term',
      'classSubjectId',
    ];
    for (const list of lists) {
      for (const param of params) {
        for (const value of CHAOS_TEXT.slice(0, -1)) {
          const join = list.endsWith('?') ? '' : '&';
          const url = `/api/v1${list}${join}${param}=${encodeURIComponent(value)}`;
          const res = await api.get(url).set(as(student));
          assertAnswered(res, `GET ${url.slice(0, 120)}`);
        }
      }
    }
  });

  it('answers chaotic ids in the address and in a class pick', async () => {
    const paths = [
      '/students/',
      '/enrollments/',
      '/grades/',
      '/announcements/',
      '/classes/',
      '/notifications/',
    ];
    for (const path of paths) {
      for (const value of CHAOS_TEXT.slice(0, -2)) {
        const url = `/api/v1${path}${encodeURIComponent(value) || '%20'}`;
        const res = await api.get(url).set(as(student));
        assertAnswered(res, `GET ${url.slice(0, 120)}`);
      }
    }
    for (const value of CHAOS_VALUES) {
      const res = await api.post('/api/v1/enrollments/next-class').set(as(student)).send({ classId: value });
      assertAnswered(res, `next-class classId=${JSON.stringify(value).slice(0, 40)}`);
    }
  });

  it('answers broken, oversized and non-JSON request bodies', async () => {
    const broken = await api
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"firstName": "Ju');
    assertAnswered(broken, 'broken JSON');
    assert.equal(broken.status, 400);

    const huge = await api
      .patch('/api/v1/auth/me')
      .set(as(student))
      .send({ address: 'a'.repeat(2 * 1024 * 1024) });
    assertAnswered(huge, 'a 2 MB body');
    assert.equal(huge.status, 400);
    assert.equal(huge.body.error.details.reason, 'payload_too_large');

    const text = await api
      .post('/api/v1/auth/register')
      .set('Content-Type', 'text/plain')
      .send('firstName=Juan');
    assertAnswered(text, 'a text body');

    const array = await api.post('/api/v1/auth/register').send([VALID_SIGN_UP]);
    assertAnswered(array, 'an array body');
    assert.equal(array.status, 400);
  });
});
