import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { pool, run } from '../src/config/db.js';
import {
  academicYearStart,
  addDaysYmd,
  currentAcademicYear,
  isoWeekdayOf,
  todayIsoWeekday,
  todayYmd,
} from '../src/utils/dates.js';
import {
  api,
  as,
  assignTeacher,
  buildSchool,
  closeWorld,
  fillClass,
  makeClass,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const today = todayYmd();

describe('dashboard', () => {
  let school;
  let quiz;
  const dashboard = async (who) => {
    const res = await api.get('/api/v1/dashboard').set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    const { admin, owner, s1, s2, csA } = school;
    await api.post('/api/v1/schedules').set(as(admin)).send({
      classSubjectId: csA.id,
      dayOfWeek: todayIsoWeekday(),
      startTime: '08:00',
      endTime: '09:00',
      room: 'R1',
    });
    await api
      .put('/api/v1/attendance/sheet')
      .set(as(owner))
      .send({
        classSubjectId: csA.id,
        date: today,
        records: [
          { studentId: s1.studentId, status: 'present' },
          { studentId: s2.studentId, status: 'absent' },
        ],
      });
    quiz = (
      await api
        .post('/api/v1/assessments')
        .set(as(owner))
        .send({ classSubjectId: csA.id, title: 'Quiz 1', type: 'quiz', term: 'term1', maxScore: 20 })
    ).body.data;
    await api
      .put(`/api/v1/assessments/${quiz.id}/grades`)
      .set(as(owner))
      .send({ grades: [{ studentId: s1.studentId, score: 15 }] });
    await api
      .post('/api/v1/announcements')
      .set(as(admin))
      .send({ title: 'Welcome', body: 'Hello', audience: 'all' });
  });

  it('rejects query parameters and anonymous callers', async () => {
    assert.equal((await api.get('/api/v1/dashboard?x=1').set(as(school.admin))).status, 400);
    assert.equal((await api.get('/api/v1/dashboard')).status, 401);
  });

  it('builds the admin payload from live counts', async () => {
    const data = await dashboard(school.admin);
    assert.equal(data.role, 'admin');
    assert.deepEqual(data.counts, {
      students: 3,
      teachers: 2,
      classes: 2,
      subjects: 2,
      teacherAssignments: 2,
      timetableSlots: 1,
      activeEnrollments: 2,
      unenrolledStudents: 1,
    });
    assert.equal(data.attendanceToday.date, today);
    assert.equal(data.attendanceToday.total, 2);
    assert.equal(data.attendanceToday.present, 1);
    assert.equal(data.attendanceToday.rate, 0.5);
    assert.deepEqual(data.enrollmentsByGrade, [{ gradeLevel: 10, students: 2 }]);
    assert.deepEqual(
      data.upcomingAssessments.map((a) => a.title),
      ['Quiz 1'],
    );
    assert.deepEqual(
      data.recentAnnouncements.map((a) => a.title),
      ['Welcome'],
    );
  });

  it('builds the teacher payload: classes, today, pending work', async () => {
    const data = await dashboard(school.owner);
    assert.equal(data.role, 'teacher');
    assert.equal(data.teacher.id, school.owner.teacherId);
    assert.deepEqual(
      data.classSubjects.map((c) => [c.id, c.studentCount, c.academicYear]),
      [[school.csA.id, 2, currentAcademicYear()]],
    );
    assert.deepEqual(
      data.homeroomClasses.map((c) => [c.id, c.studentCount]),
      [[school.classA.id, 2]],
    );
    assert.equal(data.todaySchedule.length, 1);
    assert.equal(data.todaySchedule[0].attendanceMarked, true);
    assert.deepEqual(data.attendanceToday, { sessionsScheduled: 1, sessionsMarked: 1 });
    assert.deepEqual(
      data.pendingGrading.map((p) => [p.assessmentId, p.graded, p.enrolled]),
      [[quiz.id, 1, 2]],
    );

    const idle = await dashboard(school.other);
    assert.deepEqual(idle.todaySchedule, []);
    assert.deepEqual(idle.pendingGrading, []);
    assert.deepEqual(idle.homeroomClasses, []);
  });

  it('builds the student payload for an enrolled student', async () => {
    const data = await dashboard(school.s1);
    assert.equal(data.role, 'student');
    assert.equal(data.student.id, school.s1.studentId);
    assert.equal(data.currentEnrollment.classId, school.classA.id);
    assert.equal(data.currentEnrollment.homeroomTeacher.id, school.owner.teacherId);
    assert.equal(data.todaySchedule.length, 1);
    assert.equal(data.todaySchedule[0].teacher.id, school.owner.teacherId);
    assert.equal(data.attendanceSummary.total, 1);
    assert.equal(data.attendanceSummary.rate, 1);
    assert.equal(data.gradeSummary.length, 1);
    assert.equal(data.gradeSummary[0].percentage, 75);
    assert.equal(data.recentGrades[0].score, 15);
    assert.equal(data.recentGrades[0].maxScore, 20);
    assert.equal(data.upcomingAssessments[0].title, 'Quiz 1');
    assert.equal(data.recentAnnouncements[0].title, 'Welcome');

    // The classmate has no score on Quiz 1, which s1's score makes given: the blank counts 0.
    const classmate = await dashboard(school.s2);
    assert.equal(classmate.attendanceSummary.rate, 0);
    assert.deepEqual(
      classmate.gradeSummary.map((row) => [row.assessmentsGraded, row.percentage]),
      [[0, 0]],
    );
  });

  it('builds a safe student payload when there is no active enrollment', async () => {
    const data = await dashboard(school.s3);
    assert.equal(data.currentEnrollment, null);
    assert.deepEqual(data.todaySchedule, []);
    assert.deepEqual(data.gradeSummary, []);
    assert.deepEqual(data.recentGrades, []);
    assert.deepEqual(data.upcomingAssessments, []);
    assert.equal(data.attendanceSummary.total, 0);
    assert.equal(data.attendanceSummary.rate, null);
  });

  it("keeps this year's figures for a student already placed in next year's class", async () => {
    const firstYear = Number(currentAcademicYear().slice(0, 4));
    const next = await api
      .post('/api/v1/classes')
      .set(as(school.admin))
      .send({ name: 'Next year class', gradeLevel: 11, academicYear: `${firstYear + 1}-${firstYear + 2}` });
    const placed = await makeUser('student');
    await api
      .post('/api/v1/enrollments')
      .set(as(school.admin))
      .send({ studentId: placed.studentId, classId: next.body.data.id });
    const data = await dashboard(placed);
    assert.equal(data.currentEnrollment.classId, next.body.data.id);
    assert.ok(
      data.attendanceSummary.dateFrom <= data.attendanceSummary.dateTo,
      'the date range runs forwards',
    );
    assert.deepEqual(data.todaySchedule, [], "next year's timetable is not today's");
  });

  it("lists today's lessons that have no attendance yet for the admin", async () => {
    const before = (await dashboard(school.admin)).attendanceToday;
    assert.equal(before.lessonsScheduled, 1);
    assert.equal(before.lessonsMarked, 1);
    assert.deepEqual(before.unmarkedLessons, []);

    const slotB = await api.post('/api/v1/schedules').set(as(school.admin)).send({
      classSubjectId: school.csB.id,
      dayOfWeek: todayIsoWeekday(),
      startTime: '10:00',
      endTime: '11:00',
      room: 'R2',
    });
    assert.equal(slotB.status, 201, JSON.stringify(slotB.body));
    try {
      // Nobody is in class B yet: its sheet has nobody to mark, so it is not waiting to be marked.
      const empty = (await dashboard(school.admin)).attendanceToday;
      assert.deepEqual([empty.lessonsScheduled, empty.lessonsMarked, empty.unmarkedLessons], [1, 1, []]);
      assert.deepEqual((await dashboard(school.other)).todaySchedule, []);
      assert.deepEqual((await dashboard(school.other)).attendanceToday, {
        sessionsScheduled: 0,
        sessionsMarked: 0,
      });

      await fillClass(school.classB.id, 1);
      const now = (await dashboard(school.admin)).attendanceToday;
      assert.equal(now.lessonsScheduled, 2);
      assert.equal(now.lessonsMarked, 1);
      assert.deepEqual(
        now.unmarkedLessons.map((lesson) => [lesson.classSubjectId, lesson.startTime, lesson.teacher.id]),
        [[school.csB.id, '10:00', school.other.teacherId]],
      );
      assert.deepEqual(
        (await dashboard(school.other)).todaySchedule.map((period) => period.classSubjectId),
        [school.csB.id],
      );
    } finally {
      await api.delete(`/api/v1/schedules/${slotB.body.data.id}`).set(as(school.admin));
    }
  });

  it('counts timetable periods marked on both dashboards, a double period as two', async () => {
    const second = await api.post('/api/v1/schedules').set(as(school.admin)).send({
      classSubjectId: school.csA.id,
      dayOfWeek: todayIsoWeekday(),
      startTime: '09:00',
      endTime: '10:00',
      room: 'R1',
    });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    try {
      const admin = (await dashboard(school.admin)).attendanceToday;
      const teacher = (await dashboard(school.owner)).attendanceToday;
      assert.deepEqual([admin.lessonsScheduled, admin.lessonsMarked], [2, 2], 'two periods, one sheet');
      assert.deepEqual(teacher, { sessionsScheduled: 2, sessionsMarked: 2 });
    } finally {
      await api.delete(`/api/v1/schedules/${second.body.data.id}`).set(as(school.admin));
    }
  });

  it("empties today's lessons on a school holiday and names it", async () => {
    for (const who of [school.admin, school.owner, school.s1]) {
      assert.equal((await dashboard(who)).holidayToday, null);
    }
    const created = await api
      .post('/api/v1/calendar-events')
      .set(as(school.admin))
      .send({ title: 'Founders day', type: 'holiday', startsOn: today });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const holiday = created.body.data;
    try {
      const teacher = await dashboard(school.owner);
      assert.deepEqual(teacher.holidayToday, { id: holiday.id, title: 'Founders day' });
      assert.deepEqual(teacher.todaySchedule, []);
      assert.deepEqual(teacher.attendanceToday, { sessionsScheduled: 0, sessionsMarked: 0 });
      const student = await dashboard(school.s1);
      assert.deepEqual(student.holidayToday, { id: holiday.id, title: 'Founders day' });
      assert.deepEqual(student.todaySchedule, []);
      const admin = await dashboard(school.admin);
      assert.equal(admin.holidayToday.id, holiday.id);
      assert.equal(admin.attendanceToday.lessonsScheduled, 0);
    } finally {
      await api.delete(`/api/v1/calendar-events/${holiday.id}`).set(as(school.admin));
    }
    assert.equal((await dashboard(school.owner)).todaySchedule.length, 1);
  });

  it('works for a brand-new school with no data at all', async () => {
    await resetWorld();
    const admin = await makeUser('admin');
    const teacher = await makeUser('teacher');
    const student = await makeUser('student');
    assert.equal((await dashboard(admin)).counts.unenrolledStudents, 1);
    assert.deepEqual((await dashboard(teacher)).classSubjects, []);
    assert.equal((await dashboard(student)).currentEnrollment, null);
  });
});

describe('the school day of one dashboard request', () => {
  let school;
  // A Sunday in the middle of this school's first semester, and the Monday after it.
  const year = currentAcademicYear();
  const october = `${year.slice(0, 4)}-10-01`;
  const sunday = addDaysYmd(october, 7 - isoWeekdayOf(october));
  const monday = addDaysYmd(sunday, 1);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    // In the class since the school year began, so the class has students on the days below.
    await run('UPDATE enrollments SET enrolled_on = ?', [academicYearStart(year)]);
    const slot = await api.post('/api/v1/schedules').set(as(school.admin)).send({
      classSubjectId: school.csA.id,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
    });
    assert.equal(slot.status, 201, JSON.stringify(slot.body));
  });

  it("keeps Sunday's date and Sunday's lessons when the clock passes midnight mid-request", async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(`${monday}T08:30:00Z`) });
    const onMonday = (await api.get('/api/v1/dashboard').set(as(school.admin))).body.data;
    assert.equal(onMonday.attendanceToday.date, monday);
    assert.equal(onMonday.attendanceToday.lessonsScheduled, 1, "Monday's lesson");

    t.mock.timers.setTime(Date.parse(`${sunday}T23:59:59.999Z`));
    // The clock reaches Monday while the dashboard is already being put together for Sunday.
    const realQuery = pool.query;
    t.mock.method(pool, 'query', function (sql, ...rest) {
      if (typeof sql === 'string' && sql.includes('AS unenrolled_students')) t.mock.timers.tick(1);
      return realQuery.call(this, sql, ...rest);
    });
    const res = await api.get('/api/v1/dashboard').set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { attendanceToday } = res.body.data;
    assert.equal(attendanceToday.date, sunday);
    assert.equal(attendanceToday.lessonsScheduled, 0, "no lessons on Sunday, and not Monday's either");
    assert.deepEqual(attendanceToday.unmarkedLessons, []);
  });
});

describe("the student dashboard's grades of a student who changed class", () => {
  it('shows a subject taken in both classes once, with the grade of both together', async () => {
    await resetWorld();
    const admin = await makeUser('admin');
    const teacher = await makeUser('teacher');
    const student = await makeUser('student');
    const tenA = await makeClass(admin, { name: 'Grade 10 - A' });
    const tenB = await makeClass(admin, { name: 'Grade 10 - B' });
    const [math, science] = [
      await makeSubject(admin, { name: 'Math' }),
      await makeSubject(admin, { name: 'Science' }),
    ];
    const lesson = (klass, subject) =>
      assignTeacher(admin, { classId: klass.id, subjectId: subject.id, teacherId: teacher.teacherId });
    const [mathA, mathB, scienceA] = [
      await lesson(tenA, math),
      await lesson(tenB, math),
      await lesson(tenA, science),
    ];
    // In 10-B for the first 40 days of the school year, then in 10-A.
    const yearStart = academicYearStart(currentAcademicYear());
    const moveOn = addDaysYmd(yearStart, 40);
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on)
       VALUES (?, ?, 'transferred', ?, ?), (?, ?, 'active', ?, NULL)`,
      [student.studentId, tenB.id, yearStart, moveOn, student.studentId, tenA.id, moveOn],
    );
    const exam = async (classSubject, term, daysIn, score) => {
      const created = await api
        .post('/api/v1/assessments')
        .set(as(admin))
        .send({
          classSubjectId: classSubject.id,
          title: `Exam ${term}`,
          type: 'exam',
          maxScore: 100,
          semester: 'sem1',
          term,
          assessedOn: addDaysYmd(yearStart, daysIn),
        });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const graded = await api
        .put(`/api/v1/assessments/${created.body.data.id}/grades`)
        .set(as(admin))
        .send({ grades: [{ studentId: student.studentId, score }] });
      assert.equal(graded.status, 200, JSON.stringify(graded.body));
    };
    // Math: Q1 80 in 10-B, Q2 91 in 10-A. Science only in 10-A: Q2 70.
    await exam(mathB, 'term1', 10, 80);
    await exam(mathA, 'term2', 45, 91);
    await exam(scienceA, 'term2', 45, 70);

    const res = await api.get('/api/v1/dashboard').set(as(student));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // One Math row, not 80 in 10-B and 91 in 10-A: the 1st Semester's quarters together, (80 + 91) / 2.
    assert.deepEqual(res.body.data.gradeSummary, [
      {
        subjectId: science.id,
        subjectName: 'Science',
        className: 'Grade 10 - A',
        classSubjectIds: [scienceA.id],
        assessmentsGraded: 1,
        percentage: 70,
      },
      {
        subjectId: math.id,
        subjectName: 'Math',
        className: 'Grade 10 - A / Grade 10 - B',
        classSubjectIds: [mathA.id, mathB.id],
        assessmentsGraded: 2,
        percentage: 85.5,
      },
    ]);
  });
});
