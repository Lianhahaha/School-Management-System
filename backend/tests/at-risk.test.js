import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { todayYmd } from '../src/utils/dates.js';
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

const today = todayYmd();

describe('dashboard: students who need attention', () => {
  let school;
  const atRisk = async (who) => {
    const res = await api.get('/api/v1/dashboard').set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.atRisk;
  };
  const markToday = (classSubjectId, s1Status, s2Status) =>
    api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId,
        date: today,
        records: [
          { studentId: school.s1.studentId, status: s1Status },
          { studentId: school.s2.studentId, status: s2Status },
        ],
      });

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    // Four more subjects in classA, all taught by `owner`, so today alone gives 5 attendance marks each.
    const lessons = [school.csA];
    for (let i = 0; i < 4; i += 1) {
      lessons.push(
        await assignTeacher(school.admin, {
          classId: school.classA.id,
          subjectId: (await makeSubject(school.admin)).id,
          teacherId: school.owner.teacherId,
        }),
      );
    }
    // s2 misses 4 of 5 lessons (20 %); s1 is late once and present otherwise (100 %).
    for (const [index, lesson] of lessons.entries()) {
      const res = await markToday(
        lesson.id,
        index === 0 ? 'late' : 'present',
        index === 0 ? 'present' : 'absent',
      );
      assert.equal(res.status, 200, JSON.stringify(res.body));
    }
    // s1 scores 10 / 20 (50 %), s2 19 / 20 (95 %).
    const quiz = (
      await api
        .post('/api/v1/assessments')
        .set(as(school.owner))
        .send({ classSubjectId: school.csA.id, title: 'Quiz', type: 'quiz', term: 'term1', maxScore: 20 })
    ).body.data;
    await api
      .put(`/api/v1/assessments/${quiz.id}/grades`)
      .set(as(school.owner))
      .send({
        grades: [
          { studentId: school.s1.studentId, score: 10 },
          { studentId: school.s2.studentId, score: 19 },
        ],
      });
  });

  it('flags low attendance and a low general average, with the lines it used', async () => {
    const data = await atRisk(school.admin);
    assert.equal(data.attendanceRateBelow, 0.8);
    assert.equal(data.minAttendanceMarks, 5);
    assert.equal(data.gradeAverageBelow, 75);
    assert.equal(data.total, 2);

    const s1 = data.students.find((student) => student.studentId === school.s1.studentId);
    assert.deepEqual(s1.reasons, ['grades']);
    assert.equal(s1.gradeAverage, 50);
    assert.deepEqual(s1.attendance, { rate: 1, marks: 5 });
    assert.equal(s1.className, school.classA.name);

    const s2 = data.students.find((student) => student.studentId === school.s2.studentId);
    assert.deepEqual(s2.reasons, ['attendance']);
    assert.equal(s2.attendance.rate, 0.2);
    assert.equal(s2.gradeAverage, 95);

    // Worst first: s2 is 60 points under the attendance line, s1 25 under the grade line.
    assert.deepEqual(
      data.students.map((student) => student.studentId),
      [school.s2.studentId, school.s1.studentId],
    );
  });

  it("shows a teacher only the students of the classes they teach or lead; students don't get it", async () => {
    assert.equal((await atRisk(school.owner)).total, 2);
    assert.deepEqual(await atRisk(school.other), {
      attendanceRateBelow: 0.8,
      minAttendanceMarks: 5,
      gradeAverageBelow: 75,
      total: 0,
      students: [],
    });
    const student = (await api.get('/api/v1/dashboard').set(as(school.s1))).body.data;
    assert.equal(student.atRisk, undefined);
  });

  it('needs enough attendance marks before judging attendance', async () => {
    // s3 joins classA and is absent once: 1 mark is not enough to flag anyone.
    await api
      .post('/api/v1/enrollments')
      .set(as(school.admin))
      .send({ studentId: school.s3.studentId, classId: school.classA.id });
    await api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        date: today,
        records: [{ studentId: school.s3.studentId, status: 'absent' }],
      });
    const data = await atRisk(school.admin);
    assert.equal(
      data.students.some((student) => student.studentId === school.s3.studentId),
      false,
    );
  });
});
