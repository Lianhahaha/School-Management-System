import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import {
  api,
  as,
  assignTeacher,
  buildSchool,
  closeWorld,
  makeSubject,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const DAY_MS = 86_400_000;
const slot = (classSubjectId, overrides = {}) => ({
  classSubjectId,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  room: 'R1',
  ...overrides,
});
const conflictTypes = (res) => res.body.error.details.conflicts.map((c) => c.type);

describe('schedules', () => {
  let school;
  let sameClass;
  let sameTeacher;
  before(async () => {
    await resetWorld();
    school = await buildSchool();
    // A second subject in classA taught by `other`, and a subject in classB taught by `owner`.
    sameClass = await assignTeacher(school.admin, {
      classId: school.classA.id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: school.other.teacherId,
    });
    sameTeacher = await assignTeacher(school.admin, {
      classId: school.classB.id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: school.owner.teacherId,
    });
  });

  const create = (body, who = school.admin) => api.post('/api/v1/schedules').set(as(who)).send(body);

  it('creates a slot with HH:MM times and normalises a blank room to null', async () => {
    const res = await create(slot(school.csA.id, { dayOfWeek: 5, room: '   ' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.startTime, '09:00');
    assert.equal(res.body.data.room, null);
    assert.equal(res.body.data.classSubject.teacher.id, school.owner.teacherId);
  });

  it('rejects endTime <= startTime and malformed times with 400', async () => {
    assert.equal((await create(slot(school.csA.id, { startTime: '10:00', endTime: '10:00' }))).status, 400);
    assert.equal((await create(slot(school.csA.id, { startTime: '9am' }))).status, 400);
  });

  it('is admin-write only', async () => {
    assert.equal((await create(slot(school.csA.id, { dayOfWeek: 4 }), school.owner)).status, 403);
  });

  it('reports class, teacher and room conflicts as 409 SCHEDULE_CONFLICT', async () => {
    assert.equal((await create(slot(school.csA.id, { room: 'R-A' }))).status, 201);

    const classClash = await create(
      slot(sameClass.id, { startTime: '09:30', endTime: '10:30', room: 'R-B' }),
    );
    assert.equal(classClash.status, 409);
    assert.equal(classClash.body.error.code, 'SCHEDULE_CONFLICT');
    assert.deepEqual(conflictTypes(classClash), ['class']);

    const teacherClash = await create(slot(sameTeacher.id, { room: 'R-C' }));
    assert.deepEqual(conflictTypes(teacherClash), ['teacher']);

    const roomClash = await create(slot(school.csB.id, { room: 'R-A' }));
    assert.deepEqual(conflictTypes(roomClash), ['room']);
  });

  it('allows back-to-back slots, other days and a different room', async () => {
    assert.equal((await create(slot(school.csA.id, { dayOfWeek: 2, room: 'R-X' }))).status, 201);
    const adjacent = await create(
      slot(school.csA.id, { dayOfWeek: 2, startTime: '10:00', endTime: '11:00' }),
    );
    assert.equal(adjacent.status, 201);
    assert.equal((await create(slot(school.csA.id, { dayOfWeek: 3, room: 'R-X' }))).status, 201);
  });

  it('lets a slot be updated against itself but not into a clash', async () => {
    const mine = (await create(slot(school.csA.id, { dayOfWeek: 6, room: 'R-U' }))).body.data;
    const neighbour = (
      await create(slot(school.csB.id, { dayOfWeek: 6, startTime: '11:00', endTime: '12:00', room: 'R-V' }))
    ).body.data;

    const self = await api
      .patch(`/api/v1/schedules/${mine.id}`)
      .set(as(school.admin))
      .send({ endTime: '09:45' });
    assert.equal(self.status, 200);
    assert.equal(self.body.data.endTime, '09:45');

    const clash = await api
      .patch(`/api/v1/schedules/${neighbour.id}`)
      .set(as(school.admin))
      .send({ startTime: '09:15', endTime: '09:30', room: 'R-U' });
    assert.equal(clash.status, 409);

    const badOrder = await api
      .patch(`/api/v1/schedules/${mine.id}`)
      .set(as(school.admin))
      .send({ endTime: '08:00' });
    assert.equal(badOrder.status, 400);
  });

  it('scopes reads: students see their class, teachers their own slots, foreign filters are 403', async () => {
    const asStudent = await api.get('/api/v1/schedules').set(as(school.s1));
    assert.equal(asStudent.status, 200);
    assert.ok(asStudent.body.data.length > 0);
    assert.ok(asStudent.body.data.every((s) => s.classSubject.classId === school.classA.id));

    const outsider = await api.get('/api/v1/schedules').set(as(school.s3));
    assert.equal(outsider.body.meta.total, 0);

    const foreign = await api.get(`/api/v1/schedules?classId=${school.classB.id}`).set(as(school.s1));
    assert.equal(foreign.status, 403);

    const mine = await api.get('/api/v1/schedules?teacherId=me').set(as(school.owner));
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.every((s) => s.classSubject.teacher.id === school.owner.teacherId));
  });

  it('deletes a slot and answers 404 afterwards', async () => {
    const created = (await create(slot(school.csA.id, { dayOfWeek: 7, room: 'R-D' }))).body.data;
    assert.equal((await api.delete(`/api/v1/schedules/${created.id}`).set(as(school.admin))).status, 200);
    assert.equal((await api.get(`/api/v1/schedules/${created.id}`).set(as(school.admin))).status, 404);
  });

  it('answers 503 instead of writing unchecked when the timetable lock is held elsewhere', async () => {
    const holder = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    });
    try {
      await holder.query("SELECT GET_LOCK('school_timetable', 0)");
      const res = await create(slot(school.csA.id, { dayOfWeek: 7, startTime: '14:00', endTime: '15:00' }));
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'SERVICE_UNAVAILABLE');
      assert.equal(res.body.error.details.component, 'timetable');
    } finally {
      await holder.end();
    }
    const retry = await create(slot(school.csA.id, { dayOfWeek: 7, startTime: '14:00', endTime: '15:00' }));
    assert.equal(retry.status, 201);
  });
});

describe('announcements', () => {
  let school;
  const post = (who, body) => api.post('/api/v1/announcements').set(as(who)).send(body);
  const titlesFor = async (who) =>
    (await api.get('/api/v1/announcements?limit=100').set(as(who))).body.data.map((a) => a.title);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    const { admin, owner, classA, classB } = school;
    await post(admin, { title: 'All hands', body: 'b', audience: 'all' });
    await post(admin, { title: 'Staff only', body: 'b', audience: 'teachers' });
    await post(admin, { title: 'Students only', body: 'b', audience: 'students' });
    await post(admin, { title: 'Class A news', body: 'b', audience: 'all', classId: classA.id });
    await post(admin, { title: 'Class B news', body: 'b', audience: 'all', classId: classB.id });
    await post(owner, { title: 'From owner', body: 'b', audience: 'students', classId: classA.id });
    await post(admin, {
      title: 'Scheduled',
      body: 'b',
      audience: 'all',
      publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
    });
  });

  it('shows students active notices for them, school-wide or for their class only', async () => {
    assert.deepEqual((await titlesFor(school.s1)).sort(), [
      'All hands',
      'Class A news',
      'From owner',
      'Students only',
    ]);
  });

  it('gives an unenrolled student school-wide notices only', async () => {
    assert.deepEqual((await titlesFor(school.s3)).sort(), ['All hands', 'Students only']);
  });

  it('shows teachers staff notices and notices of visible classes', async () => {
    const titles = await titlesFor(school.owner);
    for (const expected of ['All hands', 'Staff only', 'Class A news', 'From owner']) {
      assert.ok(titles.includes(expected), `missing ${expected}`);
    }
    assert.ok(!titles.includes('Students only'));
    assert.ok(!titles.includes('Class B news'));
  });

  it('shows admins every active notice and lets only them filter by status', async () => {
    assert.ok(!(await titlesFor(school.admin)).includes('Scheduled'));
    const scheduled = await api.get('/api/v1/announcements?status=scheduled').set(as(school.admin));
    assert.deepEqual(
      scheduled.body.data.map((a) => a.title),
      ['Scheduled'],
    );
    const all = await api.get('/api/v1/announcements?status=all&limit=100').set(as(school.admin));
    assert.equal(all.body.meta.total, 7);
    assert.equal((await api.get('/api/v1/announcements?status=all').set(as(school.owner))).status, 403);
  });

  it('answers 404 for a notice the caller cannot see', async () => {
    const all = await api.get('/api/v1/announcements?status=all&limit=100').set(as(school.admin));
    const staff = all.body.data.find((a) => a.title === 'Staff only');
    assert.equal((await api.get(`/api/v1/announcements/${staff.id}`).set(as(school.s1))).status, 404);
  });

  it('restricts teachers to announcing in their own classes', async () => {
    const noClass = await post(school.owner, { title: 'x', body: 'b', audience: 'all' });
    assert.equal(noClass.status, 400);
    assert.equal(noClass.body.error.details.reason, 'class_required');
    const foreign = await post(school.owner, {
      title: 'x',
      body: 'b',
      audience: 'all',
      classId: school.classB.id,
    });
    assert.equal(foreign.status, 403);
  });

  it('lets only the author or an admin edit, and rejects expiry before publication', async () => {
    const created = (
      await post(school.owner, {
        title: 'Editable',
        body: 'b',
        audience: 'students',
        classId: school.classA.id,
      })
    ).body.data;
    const url = `/api/v1/announcements/${created.id}`;
    assert.equal((await api.patch(url).set(as(school.other)).send({ title: 'y' })).status, 403);
    assert.equal((await api.patch(url).set(as(school.admin)).send({ title: 'y' })).status, 200);
    const badExpiry = await api
      .patch(url)
      .set(as(school.owner))
      .send({ expiresAt: new Date(Date.now() - DAY_MS).toISOString() });
    assert.equal(badExpiry.status, 400);
    assert.equal((await api.delete(url).set(as(school.owner))).status, 200);
  });

  it('hides expired notices from students', async () => {
    const res = await post(school.admin, {
      title: 'Expired',
      body: 'b',
      audience: 'all',
      publishedAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
      expiresAt: new Date(Date.now() - DAY_MS).toISOString(),
    });
    assert.equal(res.status, 201);
    assert.ok(!(await titlesFor(school.s1)).includes('Expired'));
  });
});
