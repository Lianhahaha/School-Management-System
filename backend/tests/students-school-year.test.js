import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { currentAcademicYear, nextAcademicYear } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, fillClass, makeClass, resetWorld } from './helpers/harness.js';

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

/** The filters of the list the "Active enrollments" tile opens (frontend AdminCountTiles). */
const TILE_LIST = `hasActiveEnrollment=true&academicYear=${thisYear}&isActive=true`;

describe("the admin dashboard's active enrollments", () => {
  let school;
  let nextClass;

  const dashboard = async () => {
    const res = await api.get('/api/v1/dashboard').set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const completeYear = async (studentIds) => {
    const res = await api
      .post('/api/v1/enrollments/complete')
      .set(as(school.admin))
      .send({ classId: school.classA.id, studentIds, nextClassId: nextClass.id });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  };
  /** The tile, the bars and the list the tile opens all count the same students. */
  const assertTileMatchesList = async () => {
    const { counts, enrollmentsByGrade } = await dashboard();
    const res = await api.get(`/api/v1/students?${TILE_LIST}&limit=1`).set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.meta.total, counts.activeEnrollments, 'the tile and its list');
    const byGrade = enrollmentsByGrade.reduce((sum, grade) => sum + grade.students, 0);
    assert.equal(byGrade, counts.activeEnrollments, 'the bars and the tile');
    return counts.activeEnrollments;
  };

  before(async () => {
    await resetWorld();
    // s1 and s2 in class A (grade 10, this school year).
    school = await buildSchool();
    nextClass = await makeClass(school.admin, {
      name: 'Grade 11 - A',
      gradeLevel: 11,
      academicYear: nextYear,
    });
    const [, switchedOff] = await fillClass(school.classB.id, 2);
    // An account switched off with its enrollment still open: deactivating through the API withdraws the
    // enrollment, but older data or a hand fix may hold one. Neither the tile nor its list counts it.
    await run('UPDATE users u JOIN students s ON s.user_id = u.id SET u.is_active = 0 WHERE s.id = ?', [
      switchedOff,
    ]);
  });

  it("counts the active students in this school year's classes", async () => {
    const { counts, enrollmentsByGrade } = await dashboard();
    assert.equal(counts.activeEnrollments, 3);
    assert.deepEqual(enrollmentsByGrade, [{ gradeLevel: 10, students: 3 }]);
  });

  it("leaves out students already placed in next year's class", async () => {
    // The End of school year run before August: s2 now has an active enrollment in next year's class.
    await completeYear([school.s2.studentId]);
    const { counts, enrollmentsByGrade } = await dashboard();
    assert.equal(counts.activeEnrollments, 2);
    assert.deepEqual(enrollmentsByGrade, [{ gradeLevel: 10, students: 2 }]);
    assert.equal(counts.classes, 2, "next year's class is not this year's either");
  });

  it('shows the number of the list the tile opens, whatever the year-end stage', async () => {
    assert.equal(await assertTileMatchesList(), 2);
    await completeYear([school.s1.studentId]);
    assert.equal(await assertTileMatchesList(), 1);
  });
});
