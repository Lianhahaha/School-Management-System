import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { currentAcademicYear, nextAcademicYear } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, makeClass, resetWorld } from './helpers/harness.js';

after(closeWorld);

const thisYear = currentAcademicYear();
const nextYear = nextAcademicYear(thisYear);

/**
 * GET /students?academicYear: the students whose active enrollment is in a class of that school year. The
 * End of school year may run before the next year starts (in June or July), placing students in next year's
 * class while this year's classes are still this year's.
 */
describe('students by the school year of their class', () => {
  let school;
  let nextClass;

  const list = async (params, who = school.admin) => {
    const res = await api.get(`/api/v1/students?${params}&limit=100`).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const ids = async (params, who) =>
    (await list(params, who)).data.map((student) => student.id).sort((a, b) => a - b);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    nextClass = await makeClass(school.admin, {
      name: 'Grade 11 - A',
      gradeLevel: 11,
      academicYear: nextYear,
    });
    // s2 finishes this school year early and moves on to next year's class; s1 stays in this year's.
    const done = await api
      .post('/api/v1/enrollments/complete')
      .set(as(school.admin))
      .send({ classId: school.classA.id, studentIds: [school.s2.studentId], nextClassId: nextClass.id });
    assert.equal(done.status, 200, JSON.stringify(done.body));
  });

  it('lists the students whose active enrollment is in a class of that year', async () => {
    const { s1, s2 } = school;
    assert.deepEqual(await ids(`academicYear=${thisYear}`), [s1.studentId]);
    assert.deepEqual(await ids(`academicYear=${nextYear}`), [s2.studentId]);
    assert.deepEqual(await ids('academicYear=2000-2001'), []);
  });

  it('matches only students in a class, with or without hasActiveEnrollment', async () => {
    assert.deepEqual(await ids(`hasActiveEnrollment=true&academicYear=${thisYear}`), [school.s1.studentId]);
    assert.deepEqual(await ids(`hasActiveEnrollment=false&academicYear=${thisYear}`), []);
  });

  it("keeps a teacher's scope", async () => {
    assert.deepEqual(await ids(`academicYear=${thisYear}`, school.owner), [school.s1.studentId]);
    assert.deepEqual(await ids(`academicYear=${thisYear}`, school.other), []);
  });

  it('refuses a malformed school year', async () => {
    for (const year of ['2026', '2026-2028', `${thisYear} `]) {
      const res = await api
        .get(`/api/v1/students?academicYear=${encodeURIComponent(year)}`)
        .set(as(school.admin));
      assert.equal(res.status, 400, year);
    }
  });
});
