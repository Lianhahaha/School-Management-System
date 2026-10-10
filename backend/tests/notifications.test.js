import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { todayYmd } from '../src/utils/dates.js';
import {
  APPLICATION_FIELDS,
  api,
  as,
  buildSchool,
  closeWorld,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

describe('notifications', () => {
  let school;
  const mine = async (who, params = '') => {
    const res = await api.get(`/api/v1/notifications${params}`).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const unread = async (who) =>
    (await api.get('/api/v1/notifications/unread-count').set(as(who))).body.data.count;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('tells students about their new class (buildSchool enrolled s1 and s2 through the API)', async () => {
    const [note] = await mine(school.s1);
    assert.equal(note.type, 'enrollment');
    assert.equal(note.title, `You are enrolled in ${school.classA.name}`);
    assert.equal(note.link, '/student/class');
    assert.equal(note.isRead, false);
    assert.equal((await mine(school.s3)).length, 0, 's3 has no class');
  });

  it('tells a student about a new and a changed grade, and nobody about an unchanged one', async () => {
    const quiz = (
      await api
        .post('/api/v1/assessments')
        .set(as(school.owner))
        .send({ classSubjectId: school.csA.id, title: 'Quiz N', type: 'quiz', term: 'term1', maxScore: 20 })
    ).body.data;
    const save = (score) =>
      api
        .put(`/api/v1/assessments/${quiz.id}/grades`)
        .set(as(school.owner))
        .send({ grades: [{ studentId: school.s1.studentId, score }] });
    await save(15);
    await save(17);
    await save(17);
    const grades = (await mine(school.s1)).filter((note) => note.type === 'grade');
    assert.deepEqual(
      grades.map((note) => [note.title, note.body]),
      [
        ['Grade updated: Quiz N', `${school.csA.subjectName} · 17 / 20 (was 15)`],
        ['New grade: Quiz N', `${school.csA.subjectName} · 15 / 20`],
      ],
    );
    assert.equal(
      (await mine(school.owner)).filter((note) => note.type === 'grade').length,
      0,
      'the teacher is not told about their own grading',
    );
  });

  it('tells a student marked absent or late, not one marked present', async () => {
    await api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        date: todayYmd(),
        records: [
          { studentId: school.s1.studentId, status: 'present' },
          { studentId: school.s2.studentId, status: 'late' },
        ],
      });
    assert.equal((await mine(school.s1)).filter((note) => note.type === 'attendance').length, 0);
    const [late] = (await mine(school.s2)).filter((note) => note.type === 'attendance');
    assert.equal(late.title, `Marked late in ${school.csA.subjectName}`);
  });

  it('tells a teacher about a lesson to teach and admins about a sign-up', async () => {
    const teacher = await makeUser('teacher');
    const subject = await makeSubject(school.admin);
    await api
      .post('/api/v1/class-subjects')
      .set(as(school.admin))
      .send({ classId: school.classB.id, subjectId: subject.id, teacherId: teacher.teacherId });
    const [teaching] = await mine(teacher);
    assert.equal(teaching.type, 'teaching');
    assert.match(teaching.title, new RegExp(`in ${school.classB.name}$`));

    const signUp = await api.post('/api/v1/auth/register').send({
      email: 'signup@school.test',
      password: 'Password123!',
      firstName: 'Sign',
      lastName: 'Up',
      ...APPLICATION_FIELDS,
    });
    const [note] = await mine(school.admin);
    assert.equal(note.type, 'signup');
    assert.equal(note.title, 'New application: Sign Up');
    assert.equal(note.body, 'Grade 7 · signup@school.test');
    assert.equal(note.link, `/admin/students/${signUp.body.data.studentId}`);
    assert.equal(note.isRead, false);
  });

  it('marks a sign-up note read for every admin once the student has a class', async () => {
    const otherAdmin = await makeUser('admin');
    const signUp = await api.post('/api/v1/auth/register').send({
      email: 'needs.class@school.test',
      password: 'Password123!',
      firstName: 'Needs',
      lastName: 'Class',
      ...APPLICATION_FIELDS,
    });
    const link = `/admin/students/${signUp.body.data.studentId}`;
    const noteOf = async (who) => (await mine(who)).find((note) => note.link === link);
    assert.equal((await noteOf(otherAdmin)).isRead, false);

    const res = await api
      .post('/api/v1/enrollments')
      .set(as(school.admin))
      .send({ studentId: signUp.body.data.studentId, classId: school.classB.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await noteOf(school.admin)).isRead, true);
    assert.equal((await noteOf(otherAdmin)).isRead, true, 'an admin who did not enroll them is done too');
    const firstSignUp = (await mine(school.admin)).find((note) => note.title === 'New application: Sign Up');
    assert.equal(firstSignUp.isRead, false, 'other sign-ups stay unread');
  });

  it('counts unread ones and marks them read, only the caller own', async () => {
    const before = await unread(school.s1);
    assert.ok(before >= 3);
    const [first] = await mine(school.s1);
    const other = (await mine(school.s2))[0];

    const one = await api
      .post('/api/v1/notifications/read')
      .set(as(school.s1))
      .send({ ids: [first.id, other.id] });
    assert.equal(one.body.data.updated, 1, "s2's notification is not touched");
    assert.equal(await unread(school.s1), before - 1);
    assert.equal((await mine(school.s2))[0].isRead, false);
    assert.equal((await mine(school.s1, '?unread=true')).length, before - 1);

    await api.post('/api/v1/notifications/read').set(as(school.s1)).send({});
    assert.equal(await unread(school.s1), 0);
  });

  it('removes the notifications of an unused account when it is deleted', async () => {
    const spareAdmin = await makeUser('admin');
    await api.post('/api/v1/auth/register').send({
      email: 'second.signup@school.test',
      password: 'Password123!',
      firstName: 'Second',
      lastName: 'Signup',
      ...APPLICATION_FIELDS,
    });
    assert.ok((await mine(spareAdmin)).length > 0);
    const res = await api.delete(`/api/v1/users/${spareAdmin.id}`).set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });
});
