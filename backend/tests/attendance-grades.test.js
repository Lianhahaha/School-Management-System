import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query, run } from '../src/config/db.js';
import { academicYearOf, addDaysYmd, isoWeekdayOf, todayYmd } from '../src/utils/dates.js';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';
import { openSession, waitForLockWaits } from './helpers/locks.js';

after(closeWorld);

const today = todayYmd();
const yesterday = addDaysYmd(today, -1);
const tomorrow = addDaysYmd(today, 1);
// On the first day of an academic year no earlier date belongs to it, so the past-date case skips.
const firstDayOfYear = academicYearOf(yesterday) !== academicYearOf(today);

describe('attendance', () => {
  let school;
  const putSheet = (who, body) => api.put('/api/v1/attendance/sheet').set(as(who)).send(body);
  const sheet = (date, records) => ({ classSubjectId: school.csA.id, date, records });

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    // The API enrolls as of today; yesterday's sheet needs students who were already in the class.
    await run('UPDATE enrollments SET enrolled_on = ?', [addDaysYmd(today, -7)]);
  });

  it('lets the assigned teacher mark a sheet and returns the whole roster', async () => {
    const res = await putSheet(
      school.owner,
      sheet(today, [{ studentId: school.s1.studentId, status: 'present' }]),
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.records.length, 2);
    const byStudent = Object.fromEntries(res.body.data.records.map((r) => [r.studentId, r]));
    assert.equal(byStudent[school.s1.studentId].status, 'present');
    assert.equal(byStudent[school.s1.studentId].markedBy.id, school.owner.id);
    assert.equal(byStudent[school.s2.studentId].status, null);
  });

  it('is idempotent: saving again updates in place and keeps unlisted students', async () => {
    const first = await api
      .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
      .set(as(school.owner));
    const id = first.body.data.records.find((r) => r.studentId === school.s1.studentId).attendanceId;
    const res = await putSheet(
      school.owner,
      sheet(today, [
        { studentId: school.s1.studentId, status: 'late', remarks: 'bus' },
        { studentId: school.s2.studentId, status: 'present' },
      ]),
    );
    const s1 = res.body.data.records.find((r) => r.studentId === school.s1.studentId);
    assert.equal(s1.attendanceId, id);
    assert.equal(s1.status, 'late');
    assert.equal(s1.remarks, 'bus');
    const count = await api.get('/api/v1/attendance?limit=100').set(as(school.admin));
    assert.equal(count.body.meta.total, 2);
  });

  it('refuses other teachers, students, future dates and students outside the class', async () => {
    const stranger = await putSheet(
      school.other,
      sheet(today, [{ studentId: school.s1.studentId, status: 'present' }]),
    );
    assert.equal(stranger.status, 403);
    assert.equal(stranger.body.error.details.reason, 'not_class_subject_owner');

    const asStudent = await putSheet(
      school.s1,
      sheet(today, [{ studentId: school.s1.studentId, status: 'present' }]),
    );
    assert.equal(asStudent.status, 403);

    const future = await putSheet(
      school.owner,
      sheet(tomorrow, [{ studentId: school.s1.studentId, status: 'present' }]),
    );
    assert.equal(future.status, 400);
    assert.equal(future.body.error.details.reason, 'future_date');

    const notEnrolled = await putSheet(
      school.owner,
      sheet(today, [
        { studentId: school.s1.studentId, status: 'absent' },
        { studentId: school.s3.studentId, status: 'present' },
      ]),
    );
    assert.equal(notEnrolled.status, 400);
    assert.equal(notEnrolled.body.error.details.reason, 'not_enrolled');
    assert.deepEqual(notEnrolled.body.error.details.invalidStudentIds, [school.s3.studentId]);
    // the whole batch was rejected: s1 is still 'late'
    const after = await api
      .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
      .set(as(school.owner));
    assert.equal(after.body.data.records.find((r) => r.studentId === school.s1.studentId).status, 'late');
  });

  it('rejects duplicate students and unknown statuses in one sheet', async () => {
    const dup = await putSheet(
      school.owner,
      sheet(today, [
        { studentId: school.s1.studentId, status: 'present' },
        { studentId: school.s1.studentId, status: 'absent' },
      ]),
    );
    assert.equal(dup.status, 400);
    const bad = await putSheet(
      school.owner,
      sheet(today, [{ studentId: school.s1.studentId, status: 'sleeping' }]),
    );
    assert.equal(bad.status, 400);
  });

  it('hides a foreign class-subject sheet from teachers and students', async () => {
    const url = `/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`;
    assert.equal((await api.get(url).set(as(school.other))).status, 403);
    assert.equal((await api.get(url).set(as(school.s1))).status, 403);
    assert.equal((await api.get(url).set(as(school.admin))).status, 200);
  });

  it(
    'summarises with rate = (present + late) / total, overall and per student',
    { skip: firstDayOfYear },
    async () => {
      await putSheet(
        school.owner,
        sheet(yesterday, [
          { studentId: school.s1.studentId, status: 'absent' },
          { studentId: school.s2.studentId, status: 'excused' },
        ]),
      );
      const overall = await api
        .get(`/api/v1/attendance/summary?classSubjectId=${school.csA.id}`)
        .set(as(school.owner));
      assert.equal(overall.status, 200);
      // s1: late, absent; s2: present, excused
      assert.deepEqual(overall.body.data, {
        total: 4,
        present: 1,
        absent: 1,
        late: 1,
        excused: 1,
        rate: 0.5,
      });

      const perStudent = await api
        .get(`/api/v1/attendance/summary?classId=${school.classA.id}&groupBy=student`)
        .set(as(school.admin));
      assert.equal(perStudent.body.data.length, 2);
      const s1 = perStudent.body.data.find((r) => r.studentId === school.s1.studentId);
      assert.equal(s1.rate, 0.5);

      const ranged = await api
        .get(`/api/v1/attendance/summary?classSubjectId=${school.csA.id}&dateFrom=${today}&dateTo=${today}`)
        .set(as(school.admin));
      assert.equal(ranged.body.data.total, 2);
      assert.equal(ranged.body.data.rate, 1);

      const none = await api
        .get(`/api/v1/attendance/summary?dateFrom=2000-01-01&dateTo=2000-01-02`)
        .set(as(school.admin));
      assert.equal(none.body.data.total, 0);
      assert.equal(none.body.data.rate, null);

      // Per week: Monday-based, oldest first, the same 4 marks in total.
      const weekly = await api
        .get(`/api/v1/attendance/summary?classSubjectId=${school.csA.id}&groupBy=week`)
        .set(as(school.owner));
      assert.equal(weekly.status, 200);
      const mondayOf = (ymd) => addDaysYmd(ymd, -((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7));
      assert.deepEqual(
        weekly.body.data.map((week) => week.weekStart),
        [...new Set([mondayOf(yesterday), mondayOf(today)])],
      );
      for (const week of weekly.body.data) assert.equal(week.label, week.weekStart);
      assert.equal(
        weekly.body.data.reduce((sum, week) => sum + week.total, 0),
        4,
      );
    },
  );

  it('rejects the unsupported search parameter instead of ignoring it', async () => {
    for (const path of ['attendance', 'grades', 'enrollments']) {
      const res = await api.get(`/api/v1/${path}?search=anna`).set(as(school.admin));
      assert.equal(res.status, 400, path);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('rejects an inverted date range with 400', async () => {
    const res = await api
      .get(`/api/v1/attendance?dateFrom=${today}&dateTo=${yesterday}`)
      .set(as(school.admin));
    assert.equal(res.status, 400);
  });

  it('scopes reads: students see only themselves, foreign filters are 403', async () => {
    const own = await api.get('/api/v1/attendance?limit=100').set(as(school.s1));
    assert.equal(own.status, 200);
    assert.equal(own.body.meta.total, 2);
    assert.ok(own.body.data.every((r) => r.studentId === school.s1.studentId));

    const alias = await api.get('/api/v1/attendance?studentId=me').set(as(school.s1));
    assert.equal(alias.body.meta.total, 2);

    const peer = await api.get(`/api/v1/attendance?studentId=${school.s2.studentId}`).set(as(school.s1));
    assert.equal(peer.status, 403);
    assert.equal(peer.body.error.details.reason, 'student_not_self');

    const foreignClass = await api
      .get(`/api/v1/attendance?classSubjectId=${school.csA.id}`)
      .set(as(school.other));
    assert.equal(foreignClass.status, 403);

    const teacherDefault = await api.get('/api/v1/attendance?limit=100').set(as(school.other));
    assert.equal(teacherDefault.body.meta.total, 0);
  });

  it('changes marks only through the sheet, so every save checks what the teacher saw', async () => {
    const list = await api
      .get(`/api/v1/attendance?studentId=${school.s1.studentId}&limit=100`)
      .set(as(school.admin));
    const url = `/api/v1/attendance/${list.body.data[0].id}`;
    assert.equal((await api.patch(url).set(as(school.admin)).send({ status: 'excused' })).status, 404);
    assert.equal((await api.delete(url).set(as(school.admin))).status, 404);
  });
});

describe('attendance follows the timetable', () => {
  let school;
  const slot = (dayOfWeek) =>
    api
      .post('/api/v1/schedules')
      .set(as(school.admin))
      .send({ classSubjectId: school.csA.id, dayOfWeek, startTime: '08:00', endTime: '09:00', room: 'R9' });
  const markToday = () =>
    api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        date: today,
        records: [{ studentId: school.s1.studentId, status: 'present' }],
      });

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('saves a new sheet only on a weekday the lesson meets, and lets existing marks be corrected', async () => {
    const otherDay = (isoWeekdayOf(today) % 7) + 1;
    const elsewhere = await slot(otherDay);
    assert.equal(elsewhere.status, 201, JSON.stringify(elsewhere.body));

    const refused = await markToday();
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error.details.reason, 'no_lesson_on_day');
    assert.deepEqual(refused.body.error.details.lessonDays, [otherDay]);
    const view = await api
      .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
      .set(as(school.owner));
    assert.deepEqual(view.body.data.lessonDays, [otherDay]);

    const todaySlot = await slot(isoWeekdayOf(today));
    assert.equal(todaySlot.status, 201, JSON.stringify(todaySlot.body));
    assert.equal((await markToday()).status, 200);

    // The timetable moves away from today: the marks already taken can still be corrected.
    assert.equal(
      (await api.delete(`/api/v1/schedules/${todaySlot.body.data.id}`).set(as(school.admin))).status,
      200,
    );
    assert.equal((await markToday()).status, 200);
  });
});

describe('assessments and grades', () => {
  let school;
  let quiz;
  const newAssessment = (who, body) =>
    api
      .post('/api/v1/assessments')
      .set(as(who))
      .send({
        classSubjectId: school.csA.id,
        title: 'Quiz 1',
        type: 'quiz',
        term: 'term1',
        maxScore: 20,
        ...body,
      });
  const putGrades = (who, id, grades) =>
    api.put(`/api/v1/assessments/${id}/grades`).set(as(who)).send({ grades });

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    quiz = (await newAssessment(school.owner, {})).body.data;
  });

  it('creates an assessment for the owner only and defaults the date to today', async () => {
    assert.equal(quiz.assessedOn, today);
    assert.equal(quiz.enrolledCount, 2);
    assert.equal(quiz.gradedCount, 0);
    assert.equal((await newAssessment(school.other, {})).status, 403);
    assert.equal((await newAssessment(school.s1, {})).status, 403);
    assert.equal((await newAssessment(school.admin, { title: 'Admin quiz' })).status, 201);
  });

  it('validates assessment input', async () => {
    assert.equal((await newAssessment(school.owner, { maxScore: 0 })).status, 400);
    assert.equal((await newAssessment(school.owner, { maxScore: 10.123 })).status, 400);
    assert.equal((await newAssessment(school.owner, { type: 'pop-quiz' })).status, 400);
    assert.equal((await newAssessment(school.owner, { term: 'term9' })).status, 400);
  });

  it('shows the roster with ungraded rows, then saves a bulk upsert idempotently', async () => {
    const empty = await api.get(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.owner));
    assert.equal(empty.status, 200);
    assert.deepEqual(
      empty.body.data.records.map((r) => r.score),
      [null, null],
    );

    const first = await putGrades(school.owner, quiz.id, [
      { studentId: school.s1.studentId, score: 15, remarks: 'ok' },
      { studentId: school.s2.studentId, score: 18.5 },
    ]);
    assert.equal(first.status, 200);
    const s1First = first.body.data.records.find((r) => r.studentId === school.s1.studentId);
    assert.equal(s1First.percentage, 75);

    const second = await putGrades(school.owner, quiz.id, [{ studentId: school.s1.studentId, score: 17 }]);
    const s1Second = second.body.data.records.find((r) => r.studentId === school.s1.studentId);
    assert.equal(s1Second.gradeId, s1First.gradeId);
    assert.equal(s1Second.score, 17);
    assert.equal(s1Second.remarks, null);
    const s2 = second.body.data.records.find((r) => r.studentId === school.s2.studentId);
    assert.equal(s2.score, 18.5);

    const all = await api.get(`/api/v1/grades?assessmentId=${quiz.id}&limit=100`).set(as(school.admin));
    assert.equal(all.body.meta.total, 2);
  });

  it('rejects scores above max, negatives and non-enrolled students as one all-or-nothing batch', async () => {
    const tooHigh = await putGrades(school.owner, quiz.id, [
      { studentId: school.s1.studentId, score: 5 },
      { studentId: school.s2.studentId, score: 21 },
    ]);
    assert.equal(tooHigh.status, 400);
    assert.equal(tooHigh.body.error.details.reason, 'score_above_max');

    assert.equal(
      (await putGrades(school.owner, quiz.id, [{ studentId: school.s1.studentId, score: -1 }])).status,
      400,
    );

    const stranger = await putGrades(school.owner, quiz.id, [
      { studentId: school.s1.studentId, score: 5 },
      { studentId: school.s3.studentId, score: 5 },
    ]);
    assert.equal(stranger.status, 400);
    assert.equal(stranger.body.error.details.reason, 'not_enrolled');

    const roster = await api.get(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.owner));
    assert.equal(roster.body.data.records.find((r) => r.studentId === school.s1.studentId).score, 17);
  });

  it('keeps the original grader on rows a re-saved sheet did not change', async () => {
    const sheet = (await newAssessment(school.owner, { title: 'Grader check' })).body.data;
    await putGrades(school.owner, sheet.id, [
      { studentId: school.s1.studentId, score: 12, remarks: 'fine' },
      { studentId: school.s2.studentId, score: 14 },
    ]);
    // The admin re-sends the whole sheet but only corrects s2's score.
    const res = await putGrades(school.admin, sheet.id, [
      { studentId: school.s1.studentId, score: 12, remarks: 'fine' },
      { studentId: school.s2.studentId, score: 15 },
    ]);
    const graderOf = (studentId) => res.body.data.records.find((r) => r.studentId === studentId).gradedBy.id;
    assert.equal(graderOf(school.s1.studentId), school.owner.id);
    assert.equal(graderOf(school.s2.studentId), school.admin.id);
    assert.equal((await api.delete(`/api/v1/assessments/${sheet.id}`).set(as(school.owner))).status, 200);
  });

  it('reserves grade entry for the owning teacher or an admin', async () => {
    const grades = [{ studentId: school.s1.studentId, score: 1 }];
    assert.equal((await putGrades(school.other, quiz.id, grades)).status, 403);
    assert.equal((await putGrades(school.s1, quiz.id, grades)).status, 403);
    assert.equal((await api.get(`/api/v1/assessments/${quiz.id}/grades`).set(as(school.other))).status, 403);
    assert.equal((await putGrades(school.admin, quiz.id, grades)).status, 200);
    await putGrades(school.owner, quiz.id, [{ studentId: school.s1.studentId, score: 17 }]);
  });

  it('refuses a maxScore below an existing grade with 409 but allows raising it', async () => {
    const url = `/api/v1/assessments/${quiz.id}`;
    const low = await api.patch(url).set(as(school.owner)).send({ maxScore: 18 });
    assert.equal(low.status, 409);
    assert.equal(low.body.error.details.reason, 'max_score_below_grades');
    assert.equal(low.body.error.details.maxExistingScore, 18.5);
    const ok = await api.patch(url).set(as(school.owner)).send({ maxScore: 19 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.maxScore, 19);
    assert.equal(ok.body.data.gradedCount, 2);
    await api.patch(url).set(as(school.owner)).send({ maxScore: 20 });
  });

  it('never stores a score above the max score when grading and lowering the max run at once', async () => {
    // Replayed race: a second session holds the assessment row, both requests queue behind it, then it lets go.
    // Grading 80/100 and lowering the max to 50 are each valid alone; together one of them must be refused.
    const exam = (await newAssessment(school.owner, { title: 'Race', maxScore: 100 })).body.data;
    const session = await openSession();
    let results;
    try {
      await session.query('START TRANSACTION');
      await session.query('SELECT id FROM assessments WHERE id = ? FOR UPDATE', [exam.id]);
      const pending = Promise.all([
        putGrades(school.owner, exam.id, [{ studentId: school.s1.studentId, score: 80 }]),
        api.patch(`/api/v1/assessments/${exam.id}`).set(as(school.owner)).send({ maxScore: 50 }),
      ]);
      await waitForLockWaits(2);
      await session.query('ROLLBACK');
      results = await pending;
    } finally {
      await session.end();
    }
    assert.equal(results.filter((res) => res.status === 200).length, 1, 'exactly one request succeeds');
    const [{ maxScore, highest }] = await query(
      `SELECT a.max_score AS maxScore, MAX(g.score) AS highest
         FROM assessments a LEFT JOIN grades g ON g.assessment_id = a.id WHERE a.id = ? GROUP BY a.id`,
      [exam.id],
    );
    assert.ok(highest === null || highest <= maxScore, `score ${highest} stored above max ${maxScore}`);
    // Leave the shared fixture as the later tests expect it.
    assert.equal((await api.delete(`/api/v1/assessments/${exam.id}`).set(as(school.owner))).status, 200);
  });

  it('scopes grade reads: a student sees only their own, foreign filters are 403', async () => {
    const own = await api.get('/api/v1/grades?limit=100').set(as(school.s1));
    assert.equal(own.status, 200);
    assert.equal(own.body.meta.total, 1);
    assert.equal(own.body.data[0].student.id, school.s1.studentId);
    assert.equal(own.body.data[0].score, 17);

    const peer = await api.get(`/api/v1/grades?studentId=${school.s2.studentId}`).set(as(school.s1));
    assert.equal(peer.status, 403);
    assert.equal(
      (await api.get(`/api/v1/grades?classSubjectId=${school.csA.id}`).set(as(school.other))).status,
      403,
    );
    assert.equal((await api.get('/api/v1/grades').set(as(school.other))).body.meta.total, 0);
    assert.equal((await api.get('/api/v1/grades?limit=100').set(as(school.owner))).body.meta.total, 2);
  });

  it('summarises points-weighted: SUM(score) / SUM(max) over graded assessments', async () => {
    const exam = (await newAssessment(school.owner, { title: 'Exam', type: 'exam', maxScore: 80 })).body.data;
    await putGrades(school.owner, exam.id, [{ studentId: school.s1.studentId, score: 40 }]);
    // s1: (17 + 40) / (20 + 80) = 57%, not the 67.5% mean of the two percentages
    const res = await api.get('/api/v1/grades/summary').set(as(school.s1));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].assessmentsGraded, 2);
    assert.equal(res.body.data[0].totalScore, 57);
    assert.equal(res.body.data[0].totalMaxScore, 100);
    assert.equal(res.body.data[0].percentage, 57);

    const byStudent = await api
      .get(`/api/v1/grades/summary?classSubjectId=${school.csA.id}&groupBy=student`)
      .set(as(school.owner));
    assert.equal(byStudent.body.data.length, 2);
    const forbidden = await api.get('/api/v1/grades/summary?groupBy=student').set(as(school.s1));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.details.reason, 'group_by_student_not_allowed');
  });

  it('deletes one grade and, separately, an assessment together with its grades', async () => {
    const list = await api.get(`/api/v1/grades?assessmentId=${quiz.id}&limit=100`).set(as(school.admin));
    const gradeId = list.body.data[0].id;
    assert.equal((await api.delete(`/api/v1/grades/${gradeId}`).set(as(school.s1))).status, 403);
    assert.equal((await api.delete(`/api/v1/grades/${gradeId}`).set(as(school.other))).status, 403);
    assert.equal((await api.delete(`/api/v1/grades/${gradeId}`).set(as(school.owner))).status, 200);
    assert.equal((await api.delete(`/api/v1/grades/${gradeId}`).set(as(school.owner))).status, 404);

    assert.equal((await api.delete(`/api/v1/assessments/${quiz.id}`).set(as(school.other))).status, 403);
    assert.equal((await api.delete(`/api/v1/assessments/${quiz.id}`).set(as(school.owner))).status, 200);
    assert.equal((await api.get(`/api/v1/assessments/${quiz.id}`).set(as(school.admin))).status, 404);
    const left = await api.get(`/api/v1/grades?assessmentId=${quiz.id}`).set(as(school.admin));
    assert.equal(left.body.meta.total, 0);
  });

  it('shows students the assessments of their class only', async () => {
    const own = await api.get('/api/v1/assessments').set(as(school.s1));
    assert.ok(own.body.data.every((a) => a.classSubject.classId === school.classA.id));
    assert.equal((await api.get('/api/v1/assessments').set(as(school.s3))).body.meta.total, 0);
    const foreign = await api.get(`/api/v1/assessments?classId=${school.classB.id}`).set(as(school.s1));
    assert.equal(foreign.status, 403);
  });
});

describe('two people editing one sheet', () => {
  let school;
  let quiz;
  const putSheet = (who, records, classSubjectId = school.csA.id) =>
    api.put('/api/v1/attendance/sheet').set(as(who)).send({ classSubjectId, date: today, records });
  const getSheet = async () =>
    (
      await api
        .get(`/api/v1/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`)
        .set(as(school.admin))
    ).body.data;
  const rowOf = (sheet, student) => sheet.records.find((r) => r.studentId === student.studentId);
  const putGrades = (who, grades) =>
    api.put(`/api/v1/assessments/${quiz.id}/grades`).set(as(who)).send({ grades });
  const lastLog = async (action) =>
    (
      await query('SELECT summary, details FROM activity_log WHERE action = ? ORDER BY id DESC LIMIT 1', [
        action,
      ])
    )[0];

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    quiz = (
      await api.post('/api/v1/assessments').set(as(school.owner)).send({
        classSubjectId: school.csA.id,
        title: 'Shared quiz',
        type: 'quiz',
        term: 'term1',
        maxScore: 20,
      })
    ).body.data;
  });

  it('refuses an attendance save made from an outdated copy, and keeps the other marks', async () => {
    const unmarked = { status: null, remarks: null };
    const first = await putSheet(school.admin, [
      { studentId: school.s1.studentId, status: 'absent', previous: unmarked },
    ]);
    assert.equal(first.status, 200);
    const stale = await putSheet(school.owner, [
      { studentId: school.s1.studentId, status: 'present', previous: unmarked },
      { studentId: school.s2.studentId, status: 'present', previous: unmarked },
    ]);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.details.reason, 'sheet_changed');
    assert.deepEqual(stale.body.error.details.changedStudentIds, [school.s1.studentId]);
    const sheet = await getSheet();
    assert.equal(rowOf(sheet, school.s1).status, 'absent');
    assert.equal(rowOf(sheet, school.s2).status, null, 'nothing of the refused save was written');
  });

  it('keeps who marked the rows a later save of the whole sheet did not change', async () => {
    const res = await putSheet(school.owner, [
      { studentId: school.s1.studentId, status: 'absent', previous: { status: 'absent', remarks: null } },
      { studentId: school.s2.studentId, status: 'late', previous: { status: null, remarks: null } },
    ]);
    assert.equal(res.status, 200);
    assert.equal(rowOf(res.body.data, school.s1).markedBy.id, school.admin.id);
    assert.equal(rowOf(res.body.data, school.s2).markedBy.id, school.owner.id);
  });

  it('logs a change of remarks alone, without notifying the student again', async () => {
    const notesBefore = (await query('SELECT COUNT(*) AS n FROM notifications'))[0].n;
    const res = await putSheet(school.owner, [
      {
        studentId: school.s2.studentId,
        status: 'late',
        remarks: 'bus',
        previous: { status: 'late', remarks: '' },
      },
    ]);
    assert.equal(res.status, 200);
    const log = await lastLog('attendance.save');
    assert.match(log.summary, /1 changed/);
    assert.deepEqual(log.details.marks[0].remarks, { from: null, to: 'bus' });
    assert.equal((await query('SELECT COUNT(*) AS n FROM notifications'))[0].n, notesBefore);
  });

  it('refuses a grade save made from an outdated copy', async () => {
    const first = await putGrades(school.admin, [
      { studentId: school.s1.studentId, score: 12, previous: { score: null, remarks: null } },
    ]);
    assert.equal(first.status, 200);
    const stale = await putGrades(school.owner, [
      { studentId: school.s1.studentId, score: 19, previous: { score: null, remarks: null } },
    ]);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.details.reason, 'sheet_changed');
    const fresh = await putGrades(school.owner, [
      { studentId: school.s1.studentId, score: 19, previous: { score: 12, remarks: null } },
    ]);
    assert.equal(fresh.status, 200);
  });

  it('keeps marks taken before a holiday was declared correctable, but opens no new sheet that day', async () => {
    const holiday = await api
      .post('/api/v1/calendar-events')
      .set(as(school.admin))
      .send({ title: 'Typhoon', type: 'holiday', startsOn: today });
    assert.equal(holiday.status, 201);
    const correction = await putSheet(school.owner, [
      { studentId: school.s1.studentId, status: 'excused', previous: { status: 'absent', remarks: null } },
    ]);
    assert.equal(correction.status, 200);
    const fresh = await putSheet(
      school.other,
      [{ studentId: school.s1.studentId, status: 'present' }],
      school.csB.id,
    );
    assert.equal(fresh.status, 400);
    assert.equal(fresh.body.error.details.reason, 'school_holiday');
  });
});

describe('assessment dates and the academic year', () => {
  let school;
  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  const create = (body) =>
    api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        title: 'Dated',
        type: 'quiz',
        term: 'term1',
        maxScore: 10,
        ...body,
      });

  it('refuses an assessment dated outside the class academic year, on create and on edit', async () => {
    const nextYearDate = addDaysYmd(today, 400);
    const refused = await create({ assessedOn: nextYearDate });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error.details.reason, 'outside_academic_year');
    assert.equal(refused.body.error.details.field, 'assessedOn');

    const created = await create({});
    assert.equal(created.status, 201);
    const moved = await api
      .patch(`/api/v1/assessments/${created.body.data.id}`)
      .set(as(school.owner))
      .send({ assessedOn: addDaysYmd(today, -400) });
    assert.equal(moved.status, 400);
    assert.equal(moved.body.error.details.reason, 'outside_academic_year');
  });
});
