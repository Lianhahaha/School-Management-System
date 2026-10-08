import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { query } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { currentAcademicYear } from '../src/utils/dates.js';
import {
  api,
  as,
  assignTeacher,
  buildSchool,
  closeWorld,
  enrollStudent,
  makeClass,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const firstYear = Number(currentAcademicYear().slice(0, 4));
/** Academic year label `offset` years from the current one (-1 = last year). */
const yearLabel = (offset) => `${firstYear + offset}-${firstYear + offset + 1}`;

describe('classes', () => {
  let admin;
  let teacher;
  let student;
  let gradeSeven;
  let gradeEight;
  let lastYear;
  const patch = (id, body, who = admin) => api.patch(`/api/v1/classes/${id}`).set(as(who)).send(body);
  const names = (res) => res.body.data.map((row) => `${row.name} ${row.academicYear}`);

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    student = await makeUser('student');
    gradeSeven = await makeClass(admin, {
      name: 'Grade 7 - A',
      gradeLevel: 7,
      homeroomTeacherId: teacher.teacherId,
    });
    gradeEight = await makeClass(admin, { name: 'Grade 8 - A', gradeLevel: 8 });
    lastYear = await makeClass(admin, { name: 'Grade 7 - A', gradeLevel: 7, academicYear: yearLabel(-1) });
  });

  it('lists classes for every role: newest year first, filtered, searched and paged', async () => {
    const all = await api.get('/api/v1/classes').set(as(student));
    assert.equal(all.status, 200);
    assert.deepEqual(names(all), [
      `Grade 7 - A ${yearLabel(0)}`,
      `Grade 8 - A ${yearLabel(0)}`,
      `Grade 7 - A ${yearLabel(-1)}`,
    ]);

    const thisYear = await api.get(`/api/v1/classes?academicYear=${yearLabel(0)}`).set(as(admin));
    assert.equal(thisYear.body.meta.total, 2);
    const seventh = await api.get('/api/v1/classes?gradeLevel=7').set(as(admin));
    assert.deepEqual(
      seventh.body.data.map((row) => row.id),
      [gradeSeven.id, lastYear.id],
    );
    const searched = await api.get('/api/v1/classes?search=Grade%208').set(as(admin));
    assert.deepEqual(
      searched.body.data.map((row) => row.id),
      [gradeEight.id],
    );
    const mine = await api.get('/api/v1/classes?homeroomTeacherId=me').set(as(teacher));
    assert.deepEqual(
      mine.body.data.map((row) => row.id),
      [gradeSeven.id],
    );
    const paged = await api.get('/api/v1/classes?limit=1&page=2').set(as(admin));
    assert.equal(paged.body.data[0].id, gradeEight.id);
    assert.equal(paged.body.meta.totalPages, 3);
  });

  it('reads one class with its homeroom teacher and student count, 404 when unknown', async () => {
    const res = await api.get(`/api/v1/classes/${gradeSeven.id}`).set(as(teacher));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.homeroomTeacher.id, teacher.teacherId);
    assert.equal(res.body.data.studentCount, 0);
    assert.equal((await api.get('/api/v1/classes/999999').set(as(admin))).status, 404);
  });

  it('lets only admins rename a class or change its homeroom teacher', async () => {
    const renamed = await patch(gradeEight.id, { name: 'Grade 8 - B', homeroomTeacherId: teacher.teacherId });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.name, 'Grade 8 - B');
    assert.equal(renamed.body.data.homeroomTeacher.id, teacher.teacherId);
    const cleared = await patch(gradeEight.id, { homeroomTeacherId: null });
    assert.equal(cleared.body.data.homeroomTeacher, null);
    assert.equal((await patch(gradeEight.id, { name: 'x' }, teacher)).status, 403);
    assert.equal((await patch(gradeEight.id, {})).status, 400);
    assert.equal((await patch(999999, { name: 'x' })).status, 404);
  });

  it('changes academic year and grade level only while no student or subject depends on the class', async () => {
    const free = await makeClass(admin);
    const moved = await patch(free.id, { academicYear: yearLabel(1), gradeLevel: 11 });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.data.academicYear, yearLabel(1));
    assert.equal(moved.body.data.gradeLevel, 11);

    const withStudent = await makeClass(admin);
    await enrollStudent(admin, { studentId: student.studentId, classId: withStudent.id });
    const yearChange = await patch(withStudent.id, { academicYear: yearLabel(1) });
    assert.equal(yearChange.status, 409);
    assert.equal(yearChange.body.error.details.reason, 'class_in_use');
    assert.deepEqual(yearChange.body.error.details.fields, ['academicYear']);
    // Unchanged values and other fields are still accepted.
    const sameValues = await patch(withStudent.id, {
      name: 'Grade 10 - Z',
      academicYear: withStudent.academicYear,
      gradeLevel: withStudent.gradeLevel,
    });
    assert.equal(sameValues.status, 200);

    const withSubject = await makeClass(admin);
    await assignTeacher(admin, {
      classId: withSubject.id,
      subjectId: (await makeSubject(admin)).id,
      teacherId: teacher.teacherId,
    });
    const gradeChange = await patch(withSubject.id, { gradeLevel: 9 });
    assert.equal(gradeChange.status, 409);
    assert.deepEqual(gradeChange.body.error.details.fields, ['gradeLevel']);
  });

  it('deletes an unused class but answers 409 in_use while anything references it', async () => {
    const inUse = await makeClass(admin);
    await enrollStudent(admin, { studentId: (await makeUser('student')).studentId, classId: inUse.id });
    const refused = await api.delete(`/api/v1/classes/${inUse.id}`).set(as(admin));
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.details.reason, 'in_use');

    const unused = await makeClass(admin);
    assert.equal((await api.delete(`/api/v1/classes/${unused.id}`).set(as(teacher))).status, 403);
    assert.equal((await api.delete(`/api/v1/classes/${unused.id}`).set(as(admin))).status, 200);
    assert.equal((await api.get(`/api/v1/classes/${unused.id}`).set(as(admin))).status, 404);
  });
});

describe('teacher reassignment and the timetable lock', () => {
  let school;
  let clash;
  const createSlot = (classSubjectId, overrides = {}) =>
    api
      .post('/api/v1/schedules')
      .set(as(school.admin))
      .send({ classSubjectId, dayOfWeek: 1, startTime: '09:00', endTime: '10:00', ...overrides });
  const reassign = (classSubjectId, teacherId) =>
    api.patch(`/api/v1/class-subjects/${classSubjectId}`).set(as(school.admin)).send({ teacherId });
  const lockIsFree = async () =>
    Number((await query("SELECT IS_FREE_LOCK(CONCAT(DATABASE(), ':timetable')) AS free"))[0].free) === 1;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    assert.equal((await createSlot(school.csA.id, { room: 'A1' })).status, 201);
    clash = (await createSlot(school.csB.id, { startTime: '09:30', endTime: '10:30', room: 'B1' })).body.data;
  });

  it("refuses a reassignment that would double-book the new teacher with the schedules' 409", async () => {
    const res = await reassign(school.csA.id, school.other.teacherId);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SCHEDULE_CONFLICT');
    assert.deepEqual(res.body.error.details.conflicts, [
      {
        type: 'teacher',
        scheduleId: clash.id,
        classSubjectId: school.csB.id,
        className: school.classB.name,
        subjectName: clash.classSubject.subjectName,
        dayOfWeek: 1,
        startTime: '09:30',
        endTime: '10:30',
        room: 'B1',
      },
    ]);
    const unchanged = await api.get(`/api/v1/class-subjects/${school.csA.id}`).set(as(school.admin));
    assert.equal(unchanged.body.data.teacher.id, school.owner.teacherId);
    assert.ok(await lockIsFree());
  });

  it('reassigns to a teacher whose lessons at those times belong to another academic year', async () => {
    const newcomer = await makeUser('teacher');
    const lastYear = await makeClass(school.admin, { academicYear: yearLabel(-1) });
    const old = await assignTeacher(school.admin, {
      classId: lastYear.id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: newcomer.teacherId,
    });
    assert.equal((await createSlot(old.id)).status, 201);
    const res = await reassign(school.csA.id, newcomer.teacherId);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.teacher.id, newcomer.teacherId);
    assert.ok(await lockIsFree());
  });

  it('serialises concurrent clashing slot edits: exactly one of them is written', async () => {
    const statuses = await Promise.all([
      createSlot(school.csA.id, { dayOfWeek: 3, room: 'C1' }),
      createSlot(school.csB.id, { dayOfWeek: 3, room: 'C1' }),
    ]);
    assert.deepEqual(statuses.map((res) => res.status).sort(), [201, 409]);
  });

  it('checks a slot edit against the row as it is inside the lock, not as it was before a concurrent edit', async () => {
    // Room R9 is taken on Tuesday 11-12 by another class and teacher. Slot S (Tuesday 09-10, no room) gets
    // two edits at once: one adds room R9, the other moves it to 11-12. Each alone is fine; together they
    // would double-book R9, so whichever runs second must be refused.
    const other = await assignTeacher(school.admin, {
      classId: (await makeClass(school.admin)).id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: (await makeUser('teacher')).teacherId,
    });
    assert.equal(
      (await createSlot(other.id, { dayOfWeek: 2, startTime: '11:00', endTime: '12:00', room: 'R9' })).status,
      201,
    );
    const slot = (await createSlot(school.csA.id, { dayOfWeek: 2 })).body.data;
    const edit = (body) => api.patch(`/api/v1/schedules/${slot.id}`).set(as(school.admin)).send(body);

    const holder = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
    let results;
    try {
      await holder.query("SELECT GET_LOCK(CONCAT(DATABASE(), ':timetable'), 0)");
      const pending = Promise.all([edit({ room: 'R9' }), edit({ startTime: '11:00', endTime: '12:00' })]);
      await delay(300); // both requests are now queued on the lock
      await holder.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':timetable'))");
      results = await pending;
    } finally {
      await holder.end();
    }
    assert.deepEqual(results.map((res) => res.status).sort(), [200, 409]);
    const [stored] = await query('SELECT start_time, room FROM schedules WHERE id = ?', [slot.id]);
    assert.ok(!(stored.room === 'R9' && String(stored.startTime).startsWith('11:00')), 'R9 is double-booked');
  });

  it('waits for the timetable lock like slot edits do (503 while another session holds it)', async () => {
    const holder = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
    try {
      await holder.query("SELECT GET_LOCK(CONCAT(DATABASE(), ':timetable'), 0)");
      const res = await reassign(school.csA.id, school.owner.teacherId);
      assert.equal(res.status, 503);
      assert.equal(res.body.error.details.component, 'timetable');
    } finally {
      await holder.end();
    }
  });
});

describe('the visible-classes filter', () => {
  let school;
  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it("limits the class list to a teacher's taught and homeroom classes", async () => {
    const all = await api.get('/api/v1/classes').set(as(school.other));
    assert.equal(all.body.meta.total, 2, 'the plain list stays school-wide');
    const own = await api.get('/api/v1/classes?visible=true').set(as(school.other));
    assert.deepEqual(
      own.body.data.map((klass) => klass.id),
      [school.classB.id],
    );
    const student = await api.get('/api/v1/classes?visible=true').set(as(school.s1));
    assert.deepEqual(
      student.body.data.map((klass) => klass.id),
      [school.classA.id],
    );
  });
});
