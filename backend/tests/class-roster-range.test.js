import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { currentAcademicYear } from '../src/utils/dates.js';
import { api, as, closeWorld, makeClass, makeUser, resetWorld } from './helpers/harness.js';

after(closeWorld);

describe("a class's students over a date range (the roster of a month's SF2)", () => {
  // March of last school year, in a class of that year whose enrollments have all closed since.
  const start = Number(currentAcademicYear().slice(0, 4));
  const lastYear = `${start - 1}-${start}`;
  const march = (day) => `${start}-03-${String(day).padStart(2, '0')}`;
  const range = `enrolledFrom=${march(1)}&enrolledTo=${march(31)}`;
  let admin;
  let homeroom;
  let oldClass;
  let otherClass;
  const students = {};

  /** A closed enrollment of `who` in `klass` from `from` to `to`, or an active one when `to` is null. */
  const enroll = (who, klass, from, to = null, status = 'completed') =>
    run(
      'INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES (?, ?, ?, ?, ?)',
      [who.studentId, klass.id, to === null ? 'active' : status, from, to],
    );

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    homeroom = await makeUser('teacher');
    oldClass = await makeClass(admin, { academicYear: lastYear, homeroomTeacherId: homeroom.teacherId });
    otherClass = await makeClass(admin);
    for (const name of ['stayer', 'leaver', 'joiner', 'lateJoiner', 'leftBefore', 'undone', 'elsewhere']) {
      students[name] = await makeUser('student');
    }
    const yearEnd = `${start}-06-01`;
    await enroll(students.stayer, oldClass, `${start - 1}-08-15`, yearEnd);
    // Moved to another class mid-month, and is in that one now.
    await enroll(students.leaver, oldClass, `${start - 1}-08-15`, march(15), 'transferred');
    await enroll(students.leaver, otherClass, march(15));
    await run("UPDATE students SET lrn = '123456789012', gender = 'female' WHERE id = ?", [
      students.leaver.studentId,
    ]);
    await enroll(students.joiner, oldClass, march(20), yearEnd);
    await enroll(students.lateJoiner, oldClass, `${start}-04-02`, yearEnd);
    // Left on the first day of the month: that day they were already in their next class.
    await enroll(students.leftBefore, oldClass, `${start - 1}-08-15`, march(1), 'withdrawn');
    // A placement undone on the day it was made: never in the class.
    await enroll(students.undone, oldClass, march(10), march(10), 'withdrawn');
    await enroll(students.elsewhere, otherClass, `${start - 1}-08-15`);
  });

  /** The names (keys of `students`) of the listed students, sorted. */
  const names = (res) =>
    res.body.data
      .map((row) => Object.keys(students).find((name) => students[name].studentId === row.id))
      .sort();

  it("lists everyone in the class on a day of the range, leavers with their LRN and sex, not today's roster", async () => {
    const now = await api.get(`/api/v1/students?classId=${oldClass.id}`).set(as(admin));
    assert.equal(now.status, 200);
    assert.deepEqual(names(now), [], "last year's class has nobody in it today");

    const res = await api.get(`/api/v1/students?classId=${oldClass.id}&${range}&limit=100`).set(as(admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(names(res), ['joiner', 'leaver', 'stayer']);
    const leaver = res.body.data.find((row) => row.id === students.leaver.studentId);
    assert.deepEqual([leaver.lrn, leaver.gender], ['123456789012', 'female']);
    assert.equal(leaver.currentEnrollment.classId, otherClass.id, 'each row still shows the class now');
  });

  it("gives the class's homeroom teacher the same roster, leavers included", async () => {
    const res = await api.get(`/api/v1/students?classId=${oldClass.id}&${range}`).set(as(homeroom));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(names(res), ['joiner', 'leaver', 'stayer']);
    const stranger = await makeUser('teacher');
    const refused = await api.get(`/api/v1/students?classId=${oldClass.id}&${range}`).set(as(stranger));
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error.details.reason, 'class_not_visible');
  });

  it('needs both ends of the range, in order, and a class', async () => {
    for (const query of [
      `classId=${oldClass.id}&enrolledFrom=${march(1)}`,
      `classId=${oldClass.id}&enrolledTo=${march(31)}`,
      range,
      `classId=${oldClass.id}&enrolledFrom=${march(31)}&enrolledTo=${march(1)}`,
    ]) {
      const res = await api.get(`/api/v1/students?${query}`).set(as(admin));
      assert.equal(res.status, 400, query);
    }
  });
});
