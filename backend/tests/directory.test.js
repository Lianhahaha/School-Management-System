import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, as, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

describe('student and teacher directories', () => {
  let admin;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
  });

  it('find students and teachers by their full name', async () => {
    const student = await makeUser('student', { firstName: 'Liam', lastName: 'Cruz' });
    const teacher = await makeUser('teacher', { firstName: 'Liam', lastName: 'Cruz' });
    await makeUser('student', { firstName: 'Liam', lastName: 'Walker' });
    await makeUser('teacher', { firstName: 'Liam', lastName: 'Walker' });

    const students = await api.get('/api/v1/students?search=Liam%20Cruz').set(as(admin));
    assert.equal(students.status, 200);
    assert.deepEqual(
      students.body.data.map((row) => row.id),
      [student.studentId],
    );
    const teachers = await api.get('/api/v1/teachers?search=liam%20cruz').set(as(admin));
    assert.equal(teachers.status, 200);
    assert.deepEqual(
      teachers.body.data.map((row) => row.id),
      [teacher.teacherId],
    );
  });

  it('refuse a date of birth in the future when an admin edits a student, as registration does', async () => {
    const student = await makeUser('student');
    const url = `/api/v1/students/${student.studentId}`;
    const future = await api.patch(url).set(as(admin)).send({ dateOfBirth: '2999-01-01' });
    assert.equal(future.status, 400);
    assert.deepEqual(
      future.body.error.details.issues.map((issue) => issue.path),
      ['body.dateOfBirth'],
    );
    const past = await api.patch(url).set(as(admin)).send({ dateOfBirth: '2012-05-04' });
    assert.equal(past.status, 200);
    assert.equal(past.body.data.dateOfBirth, '2012-05-04');
  });

  it('records a 12-digit LRN once per student, finds the student by it, and clears it with null', async () => {
    const [ana, ben] = [await makeUser('student'), await makeUser('student')];
    const patch = (student, body) =>
      api.patch(`/api/v1/students/${student.studentId}`).set(as(admin)).send(body);

    const set = await patch(ana, { lrn: ' 136512140001 ' });
    assert.equal(set.status, 200);
    assert.equal(set.body.data.lrn, '136512140001');

    const short = await patch(ben, { lrn: '13651214000' });
    assert.equal(short.status, 400);
    assert.deepEqual(
      short.body.error.details.issues.map((issue) => issue.path),
      ['body.lrn'],
    );
    const taken = await patch(ben, { lrn: '136512140001' });
    assert.equal(taken.status, 409);
    assert.equal(taken.body.error.details.key, 'students.uq_students_lrn');

    const found = await api.get('/api/v1/students?search=136512140001').set(as(admin));
    assert.deepEqual(
      found.body.data.map((row) => row.id),
      [ana.studentId],
    );

    const cleared = await patch(ana, { lrn: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.data.lrn, null);
    assert.equal((await patch(ben, { lrn: '136512140001' })).status, 200, 'a cleared LRN is free again');
  });
});
