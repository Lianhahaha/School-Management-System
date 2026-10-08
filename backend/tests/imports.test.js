import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query } from '../src/config/db.js';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';
import { firebaseUsers } from './helpers/fakeFirebase.js';

after(closeWorld);

describe('student import', () => {
  let school;
  const send = (who, body) => api.post('/api/v1/imports/students').set(as(who)).send(body);
  const studentCount = async () => (await query('SELECT COUNT(*) AS n FROM students'))[0].n;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('is for admins only and takes no shared password', async () => {
    const rows = [{ line: 2, email: 'a@school.test', firstName: 'Ana', lastName: 'Cruz' }];
    assert.equal((await send(school.owner, { dryRun: true, rows })).status, 403);
    const shared = await send(school.admin, { password: 'Welcome2026!', rows });
    assert.equal(shared.status, 400);
    assert.equal(await studentCount(), 3);
  });

  it('checks every row in a dry run and writes nothing', async () => {
    const before = await studentCount();
    const res = await send(school.admin, {
      dryRun: true,
      rows: [
        { line: 2, email: 'maria@school.test', firstName: 'maria', lastName: 'santos', gender: 'Female' },
        { line: 3, email: 'not-an-email', firstName: 'Jose', lastName: 'Reyes' },
        { line: 4, email: 'MARIA@school.test', firstName: 'Maria', lastName: 'Dup' },
        { line: 5, email: school.s1.email, firstName: 'Taken', lastName: 'Email' },
        {
          line: 6,
          email: 'class@school.test',
          firstName: 'No',
          lastName: 'Class',
          className: 'Grade 99 - Z',
        },
        { line: 7, email: '', firstName: '', lastName: 'Blank' },
      ],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { total, valid, problems } = res.body.data;
    assert.equal(total, 6);
    assert.equal(valid, 1);
    const fieldsOf = (line) => problems.find((problem) => problem.line === line)?.errors.map((e) => e.field);
    assert.equal(fieldsOf(2), undefined, 'line 2 is fine (gender in any case)');
    assert.deepEqual(fieldsOf(3), ['email']);
    assert.deepEqual(fieldsOf(4), ['email'], 'the same email as line 2, ignoring case');
    assert.match(problems.find((p) => p.line === 4).errors[0].message, /row 2/);
    assert.deepEqual(fieldsOf(5), ['email']);
    assert.deepEqual(fieldsOf(6), ['className']);
    assert.deepEqual(fieldsOf(7).sort(), ['email', 'firstName']);
    assert.equal(await studentCount(), before);
  });

  it('refuses the whole batch when a row has a problem', async () => {
    const before = await studentCount();
    const res = await send(school.admin, {
      rows: [
        { line: 2, email: 'ok@school.test', firstName: 'Ok', lastName: 'Row' },
        { line: 3, email: 'bad', firstName: 'Bad', lastName: 'Row' },
      ],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.reason, 'import_invalid');
    assert.deepEqual(
      res.body.error.details.problems.map((problem) => problem.line),
      [3],
    );
    assert.equal(await studentCount(), before);
  });

  it('creates each account with its own temporary password and enrolls it in the named class', async () => {
    const res = await send(school.admin, {
      rows: [
        {
          line: 2,
          email: 'lea@school.test',
          firstName: 'lea',
          lastName: 'garcia',
          studentNumber: 'stu-2026-0777',
          className: school.classA.name.toLowerCase(),
        },
        { line: 3, email: 'ben@school.test', firstName: 'Ben', lastName: 'Lim', phone: '' },
      ],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [lea, ben] = res.body.data.results;
    assert.equal(lea.status, 'created');
    assert.equal(lea.studentNumber, 'STU-2026-0777');
    assert.equal(lea.className, school.classA.name);
    assert.equal(ben.status, 'created');
    assert.equal(ben.className, null);
    assert.match(ben.studentNumber, /^STU-\d{4}-\d{4,}$/);

    const passwordFormat = /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/;
    assert.match(lea.temporaryPassword, passwordFormat);
    assert.match(ben.temporaryPassword, passwordFormat);
    assert.notEqual(lea.temporaryPassword, ben.temporaryPassword);
    const firebase = firebaseUsers().find((user) => user.email === 'lea@school.test');
    assert.equal(firebase.password, lea.temporaryPassword);
    const [row] = await query(
      `SELECT u.first_name, e.class_id FROM students s JOIN users u ON u.id = s.user_id
         LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' WHERE s.id = ?`,
      [lea.studentId],
    );
    assert.equal(row.firstName, 'Lea', 'names typed in lower case get capitals');
    assert.equal(row.classId, school.classA.id);

    // Importing the same file again: both emails are now taken.
    const again = await send(school.admin, {
      dryRun: true,
      rows: [{ line: 2, email: 'lea@school.test', firstName: 'Lea', lastName: 'Garcia' }],
    });
    assert.equal(again.body.data.valid, 0);
  });
});
