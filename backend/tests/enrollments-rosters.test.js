import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { BULK_MAX_ROWS } from '../src/constants/shared.js';
import { academicYearStart, addDaysYmd, currentAcademicYear, todayYmd } from '../src/utils/dates.js';
import {
  api,
  as,
  buildSchool,
  closeWorld,
  enrollStudent,
  makeClass,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const today = todayYmd();
const yesterday = addDaysYmd(today, -1);
const tomorrow = addDaysYmd(today, 1);
const firstYear = Number(currentAcademicYear().slice(0, 4));
/** Academic year label `offset` years from the current one (-1 = last year). */
const yearLabel = (offset) => `${firstYear + offset}-${firstYear + offset + 1}`;

describe('enrollment into past, current and future academic years', () => {
  let admin;
  let past;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    past = await makeClass(admin, { academicYear: yearLabel(-1) });
  });

  const expectPastYear = (res) => {
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.reason, 'past_academic_year');
    assert.equal(res.body.error.details.field, 'classId');
  };

  it('refuses a class of a past academic year for enroll, bulk enroll and transfer', async () => {
    const student = await makeUser('student');
    const body = { studentId: student.studentId, classId: past.id };
    expectPastYear(await api.post('/api/v1/enrollments').set(as(admin)).send(body));
    expectPastYear(
      await api
        .post('/api/v1/enrollments/bulk')
        .set(as(admin))
        .send({ classId: past.id, studentIds: [student.studentId] }),
    );
    await enrollStudent(admin, { studentId: student.studentId, classId: (await makeClass(admin)).id });
    expectPastYear(await api.post('/api/v1/enrollments/transfer').set(as(admin)).send(body));
  });

  it('accepts classes of the current and of a future academic year', async () => {
    const thisYear = await enrollStudent(admin, {
      studentId: (await makeUser('student')).studentId,
      classId: (await makeClass(admin)).id,
    });
    assert.equal(thisYear.class.academicYear, currentAcademicYear());
    const nextYear = await enrollStudent(admin, {
      studentId: (await makeUser('student')).studentId,
      classId: (await makeClass(admin, { academicYear: yearLabel(1) })).id,
    });
    assert.equal(nextYear.class.academicYear, yearLabel(1));
  });

  it('bulk-enrolls the largest allowed batch and returns every enrollment', async () => {
    const klass = await makeClass(admin);
    const students = [];
    for (let i = 0; i < BULK_MAX_ROWS; i += 1) students.push(await makeUser('student'));
    const studentIds = students.map((student) => student.studentId);
    const res = await api
      .post('/api/v1/enrollments/bulk')
      .set(as(admin))
      .send({ classId: klass.id, studentIds });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.created, BULK_MAX_ROWS);
    assert.deepEqual(
      res.body.data.enrollments.map((enrollment) => enrollment.studentId),
      studentIds,
    );
  });

  it('answers already_enrolled when the same student is enrolled twice at once', async () => {
    const student = await makeUser('student');
    const body = { studentId: student.studentId, classId: (await makeClass(admin)).id };
    const results = await Promise.all([
      api.post('/api/v1/enrollments').set(as(admin)).send(body),
      api.post('/api/v1/enrollments').set(as(admin)).send(body),
    ]);
    const statuses = results.map((res) => res.status).sort();
    assert.deepEqual(statuses, [201, 409]);
    const refused = results.find((res) => res.status === 409);
    assert.equal(refused.body.error.details.reason, 'already_enrolled');
  });

  it('answers 400 invalid_reference for an unknown class', async () => {
    const student = await makeUser('student');
    const res = await api
      .post('/api/v1/enrollments')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: 999999 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.reason, 'invalid_reference');
  });
});

/**
 * classA: s1, s2 and s4 were enrolled a week ago. Today s1 was marked present and graded on qToday, then s1 and
 * s4 moved to classB and s3 joined classA. So yesterday classA was {s1, s2, s4}; today it is {s2, s3}.
 */
describe('rosters of past dates', () => {
  let school;
  let s4;
  let qToday;
  let qYesterday;
  let qTomorrow;
  const sheetUrl = (classSubjectId, date) =>
    `/api/v1/attendance/sheet?classSubjectId=${classSubjectId}&date=${date}`;
  const sheetIds = async (classSubjectId, date) => {
    const res = await api.get(sheetUrl(classSubjectId, date)).set(as(school.admin));
    assert.equal(res.status, 200);
    return res.body.data.records.map((row) => row.studentId).sort();
  };
  const putSheet = (who, classSubjectId, date, studentIds) =>
    api
      .put('/api/v1/attendance/sheet')
      .set(as(who))
      .send({
        classSubjectId,
        date,
        records: studentIds.map((studentId) => ({ studentId, status: 'present' })),
      });
  const newAssessment = async (title, assessedOn) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({ classSubjectId: school.csA.id, title, type: 'quiz', term: 'term1', maxScore: 10, assessedOn });
    assert.equal(res.status, 201);
    return res.body.data;
  };
  const putGrades = (assessmentId, studentIds) =>
    api
      .put(`/api/v1/assessments/${assessmentId}/grades`)
      .set(as(school.owner))
      .send({ grades: studentIds.map((studentId) => ({ studentId, score: 5 })) });
  const transfer = (studentId, classId) =>
    api.post('/api/v1/enrollments/transfer').set(as(school.admin)).send({ studentId, classId });
  const ids = (...users) => users.map((user) => user.studentId).sort();

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    const { admin, owner, s1, s2, s3, classA, classB, csA } = school;
    s4 = await makeUser('student');
    await enrollStudent(admin, { studentId: s4.studentId, classId: classA.id });
    await run('UPDATE enrollments SET enrolled_on = ?', [addDaysYmd(today, -7)]);

    assert.equal((await putSheet(owner, csA.id, today, [s1.studentId])).status, 200);
    qToday = await newAssessment('Today', today);
    assert.equal((await putGrades(qToday.id, [s1.studentId, s2.studentId])).status, 200);
    assert.equal((await transfer(s1.studentId, classB.id)).status, 201);
    assert.equal((await transfer(s4.studentId, classB.id)).status, 201);
    await enrollStudent(admin, { studentId: s3.studentId, classId: classA.id });
    qYesterday = await newAssessment('Yesterday', yesterday);
    qTomorrow = await newAssessment('Tomorrow', tomorrow);
  });

  it("builds an attendance sheet from the class's members on that date", async () => {
    const { s1, s2, s3, csA, csB } = school;
    assert.deepEqual(await sheetIds(csA.id, yesterday), ids(s1, s2, s4));
    assert.deepEqual(await sheetIds(csB.id, yesterday), []);
    // s4 moved today, so today they belong to classB only; s1 stays on classA's sheet through today's mark.
    assert.deepEqual(await sheetIds(csA.id, today), ids(s1, s2, s3));
    assert.deepEqual(await sheetIds(csB.id, today), ids(s1, s4));
  });

  it('saves exactly the students on that roster', async () => {
    const { owner, other, s1, csA, csB } = school;
    const left = await putSheet(owner, csA.id, today, [s4.studentId]);
    assert.equal(left.status, 400);
    assert.equal(left.body.error.details.reason, 'not_enrolled');
    assert.deepEqual(left.body.error.details.invalidStudentIds, [s4.studentId]);
    assert.equal((await putSheet(owner, csA.id, today, [s1.studentId])).status, 200); // correction of a mark
    assert.equal((await putSheet(other, csB.id, today, [s1.studentId, s4.studentId])).status, 200);
  });

  it("rejects attendance dated outside the class's academic year", async () => {
    const lastYear = addDaysYmd(academicYearStart(currentAcademicYear()), -1);
    const res = await putSheet(school.owner, school.csA.id, lastYear, [school.s2.studentId]);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.reason, 'outside_academic_year');
    assert.equal(res.body.error.details.academicYear, currentAcademicYear());
  });

  it("builds a grade roster from the class's members on the assessment date", async () => {
    const { s1, s2, s3 } = school;
    const roster = async (assessment) => {
      const res = await api.get(`/api/v1/assessments/${assessment.id}/grades`).set(as(school.owner));
      return res.body.data.records.map((row) => row.studentId).sort();
    };
    assert.deepEqual(await roster(qYesterday), ids(s1, s2, s4));
    assert.deepEqual(await roster(qToday), ids(s1, s2, s3)); // s1 left today but is already graded

    assert.equal((await putGrades(qYesterday.id, [s4.studentId])).status, 200);
    const joinedLater = await putGrades(qYesterday.id, [s3.studentId]);
    assert.equal(joinedLater.status, 400);
    assert.deepEqual(joinedLater.body.error.details.invalidStudentIds, [s3.studentId]);
  });

  it('counts graded and enrolled students on the same roster', async () => {
    const res = await api.get(`/api/v1/assessments/${qToday.id}`).set(as(school.owner));
    // s1 and s2 are graded; s3 joined today and is not: 2 of 3, not a misleading 2 of 2.
    assert.equal(res.body.data.gradedCount, 2);
    assert.equal(res.body.data.enrolledCount, 3);
  });

  it('lists pending grading up to today only, with roster-based counts', async () => {
    const res = await api.get('/api/v1/dashboard').set(as(school.owner));
    assert.deepEqual(
      res.body.data.pendingGrading.map((row) => [row.assessmentId, row.graded, row.enrolled]),
      [
        [qToday.id, 2, 3],
        [qYesterday.id, 1, 3],
      ],
    );
    assert.ok(!res.body.data.pendingGrading.some((row) => row.assessmentId === qTomorrow.id));
  });
});
