import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { academicYearStart, addDaysYmd, currentAcademicYear, todayYmd } from '../src/utils/dates.js';
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
  let quiz;
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
    quiz = (
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
    // s3 joins classA and is absent once: 1 mark is not enough to flag anyone. s3 joined on the quiz's day,
    // so the quiz counts for them too: a passing score keeps the grades out of it.
    await api
      .post('/api/v1/enrollments')
      .set(as(school.admin))
      .send({ studentId: school.s3.studentId, classId: school.classA.id });
    await api
      .put(`/api/v1/assessments/${quiz.id}/grades`)
      .set(as(school.owner))
      .send({ grades: [{ studentId: school.s3.studentId, score: 18 }] });
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

describe("a teacher's at-risk list and a student who changed class", () => {
  let school;
  let moved;
  const yearStart = academicYearStart(currentAcademicYear());
  const atRiskEntry = async (who) => {
    const res = await api.get('/api/v1/dashboard').set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.atRisk.students.find((student) => student.studentId === moved.studentId);
  };
  const examIn = async (classSubject, teacher, daysIn, score) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(teacher))
      .send({
        classSubjectId: classSubject.id,
        title: `Exam ${daysIn}`,
        type: 'exam',
        term: 'term1',
        maxScore: 100,
        assessedOn: addDaysYmd(yearStart, daysIn),
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const saved = await api
      .put(`/api/v1/assessments/${res.body.data.id}/grades`)
      .set(as(teacher))
      .send({ grades: [{ studentId: moved.studentId, score }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  };

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    moved = school.s3;
    // 40 days in classB (csB, taught by `other`), then classA (csA, taught by `owner`): 20 in classB's
    // subject, 90 in classA's, a general average of 55.
    const moveOn = addDaysYmd(yearStart, 40);
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on)
       VALUES (?, ?, 'transferred', ?, ?), (?, ?, 'active', ?, NULL)`,
      [moved.studentId, school.classB.id, yearStart, moveOn, moved.studentId, school.classA.id, moveOn],
    );
    await examIn(school.csB, school.other, 10, 20);
    await examIn(school.csA, school.owner, 50, 90);
  });

  it('judges the student on the whole year, the class they left included, as the office does', async () => {
    const office = await atRiskEntry(school.admin);
    assert.deepEqual([office.reasons, office.gradeAverage], [['grades'], 55]);
    // The new class's teacher sees the same figure; within their own classes it would be 90 and pass.
    const teacher = await atRiskEntry(school.owner);
    assert.deepEqual(
      [teacher.reasons, teacher.gradeAverage, teacher.className],
      [['grades'], 55, school.classA.name],
    );
    // The old class's teacher no longer has the student.
    assert.equal(await atRiskEntry(school.other), undefined);
  });
});
