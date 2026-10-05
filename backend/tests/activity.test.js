import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query, run } from '../src/config/db.js';
import { todayYmd } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

const today = todayYmd();

describe('activity log', () => {
  let school;
  const activity = async (params = '') => {
    const res = await api.get(`/api/v1/activity${params}`).set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const latest = async (action) => (await activity()).find((entry) => entry.action === action);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('is for admins only', async () => {
    assert.equal((await api.get('/api/v1/activity').set(as(school.owner))).status, 403);
    assert.equal((await api.get('/api/v1/activity').set(as(school.s1))).status, 403);
  });

  it('records who did it: the signed-in admin, or the system outside a request', async () => {
    const entries = await activity('?area=accounts');
    const system = entries.find((entry) => entry.summary.includes(school.admin.email));
    assert.equal(system.actor, null, 'buildSchool created the admin outside a request');
    assert.equal(system.actorName, 'System');

    const enrollment = await latest('enrollment.create');
    assert.deepEqual(enrollment.actor, {
      id: school.admin.id,
      name: `${school.admin.firstName} ${school.admin.lastName}`,
      role: 'admin',
    });
    assert.equal(enrollment.area, 'enrollments');
  });

  it('keeps every new and changed score of a grade save with the previous score', async () => {
    const quiz = (
      await api
        .post('/api/v1/assessments')
        .set(as(school.owner))
        .send({ classSubjectId: school.csA.id, title: 'Quiz A', type: 'quiz', term: 'term1', maxScore: 20 })
    ).body.data;
    const save = (grades) =>
      api.put(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.owner)).send({ grades });
    await save([
      { studentId: school.s1.studentId, score: 15 },
      { studentId: school.s2.studentId, score: 12 },
    ]);
    await save([
      { studentId: school.s1.studentId, score: 18 },
      { studentId: school.s2.studentId, score: 12 }, // unchanged: not in the entry
    ]);

    const saves = (await activity('?area=grades')).filter((entry) => entry.action === 'grades.save');
    assert.equal(saves.length, 2);
    const [second, first] = saves; // newest first
    assert.match(first.summary, /Quiz A .*2 new/);
    assert.match(second.summary, /1 changed/);
    assert.deepEqual(second.details.changes, [
      {
        studentId: school.s1.studentId,
        student: `${school.s1.firstName} ${school.s1.lastName}`,
        from: 15,
        to: 18,
      },
    ]);
    assert.equal(second.entityId, quiz.id);
    assert.equal(second.actor.id, school.owner.id);

    // A save that changes nothing adds nothing.
    await save([{ studentId: school.s2.studentId, score: 12 }]);
    assert.equal((await activity('?area=grades')).filter((e) => e.action === 'grades.save').length, 2);

    // The student's name finds the entry through the details.
    const found = await activity(`?search=${encodeURIComponent(school.s1.lastName)}&area=grades`);
    assert.ok(found.some((entry) => entry.id === second.id));
  });

  it('keeps absences and changed marks of an attendance save', async () => {
    const sheet = (s1, s2) =>
      api
        .put('/api/v1/attendance/sheet')
        .set(as(school.owner))
        .send({
          classSubjectId: school.csA.id,
          date: today,
          records: [
            { studentId: school.s1.studentId, status: s1 },
            { studentId: school.s2.studentId, status: s2 },
          ],
        });
    await sheet('present', 'absent');
    await sheet('present', 'excused');
    const [changed, first] = (await activity('?area=attendance')).filter(
      (e) => e.action === 'attendance.save',
    );
    assert.deepEqual(
      first.details.marks.map((mark) => [mark.studentId, mark.from, mark.to]),
      [[school.s2.studentId, null, 'absent']],
      'a new "present" is counted but not listed',
    );
    assert.match(changed.summary, /1 changed/);
    assert.deepEqual(changed.details.marks[0].from, 'absent');
    assert.deepEqual(changed.details.marks[0].to, 'excused');
  });

  it('records account status, edits with before and after, and the actor of a self sign-up', async () => {
    const teacher = await makeUser('teacher');
    await api.patch(`/api/v1/users/${teacher.id}`).set(as(school.admin)).send({ phone: '+63 917 000 0000' });
    const edit = await latest('user.update');
    assert.deepEqual(edit.details.changes, { phone: { from: null, to: '+63 917 000 0000' } });
    assert.match(edit.summary, /phone/);

    await api.patch(`/api/v1/users/${teacher.id}/status`).set(as(school.admin)).send({ isActive: false });
    assert.match((await latest('user.deactivate')).summary, /Deactivated the teacher account/);

    const signUp = await api.post('/api/v1/auth/register').send({
      email: 'new.student@school.test',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'Student',
    });
    assert.equal(signUp.status, 201);
    const registered = await latest('user.register');
    assert.equal(registered.actor.id, signUp.body.data.id);
    assert.equal(registered.actor.role, 'student');
  });

  it('filters by school day and never fails the change when the log cannot be written', async () => {
    assert.ok((await activity(`?dateFrom=${today}&dateTo=${today}`)).length > 0);
    assert.equal((await activity('?dateFrom=2000-01-01&dateTo=2000-01-02')).length, 0);

    // Without the log table every insert fails; the calendar entry is still created.
    await run('RENAME TABLE activity_log TO activity_log_away');
    let res;
    try {
      res = await api
        .post('/api/v1/calendar-events')
        .set(as(school.admin))
        .send({ title: 'Logged nowhere', type: 'event', startsOn: today });
    } finally {
      await run('RENAME TABLE activity_log_away TO activity_log');
    }
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [{ n }] = await query(
      "SELECT COUNT(*) AS n FROM activity_log WHERE summary LIKE '%Logged nowhere%'",
    );
    assert.equal(n, 0);
  });
});
