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
});
