import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { bearer } from './helpers/fakeFirebase.js';
import {
  APPLICATION_FIELDS,
  api,
  as,
  assignTeacher,
  closeWorld,
  makeClass,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const YEAR = '2030-2031';
const NEXT_YEAR = '2031-2032';

/**
 * Moves the school's clock to 9 in the morning of `ymd`. Only Date is mocked (timers run as usual); "today" is
 * read in APP_TIMEZONE, UTC in the tests (helpers/setup.js), so the day never depends on the machine.
 */
const on = (ymd) => mock.timers.setTime(Date.parse(`${ymd}T09:00:00Z`));

const [P, A, L, E] = ['present', 'absent', 'late', 'excused'];
/** Quarterly grades of a semester (term1 = 1st Quarter … term4 = 4th Quarter). */
const quarters = (term1 = null, term2 = null, term3 = null, term4 = null) => ({ term1, term2, term3, term4 });
const semesters = (sem1, sem2) => ({ sem1, sem2 });

/**
 * One school year of a small Grade 7, driven through the HTTP API on a fixed calendar (2030-2031), with every
 * figure worked out by hand from the rules in README "Design decisions" and utils/grading.js:
 *
 *   Mathematics 7      K-12, math and science group: written work 40 %, performance tasks 40 %, quarterly
 *                      assessment 20 %; a component with nothing given in the quarter is left out and the
 *                      others scaled up; the initial grade is transmuted (60 and above: 75 + one step per 1.6;
 *                      below 60: 60 + one step per 4); semester = mean of its quarters, year = mean of the
 *                      semesters, each rounded to a whole number, half up.
 *   Values Education 7 on points: SUM(score) / SUM(max) per quarter, 2 decimals; semester and year the means
 *                      of the grades below, 2 decimals.
 *   A blank score counts 0 once someone has a score for the assessment; an assessment dated before a
 *   transferee joined a class, or after they left it, does not count for them. General average = mean of the
 *   subjects' grades, 2 decimals. Attendance rate = (present + late) / marks.
 *
 * Grade 7 - Rizal: Ana Reyes (strong; one blank), Ben Santos (weak; one blank, often absent), Carla Cruz (moves
 * to Bonifacio on 2031-01-20). Grade 7 - Bonifacio: Dan Lim. Eve Tan signs up and never picks a section.
 */
describe('one school year, end to end', () => {
  let admin;
  let teacher;
  let math;
  let values;
  let rizal;
  let bonifacio;
  let grade8;
  const cs = {};
  const kids = {};

  const expectStatus = (res, status) => assert.equal(res.status, status, JSON.stringify(res.body));
  const ok = async (request, status = 200) => {
    const res = await request;
    expectStatus(res, status);
    return res.body.data;
  };
  const refused = async (request, status, reason) => {
    const res = await request;
    expectStatus(res, status);
    assert.equal(res.body.error.details.reason, reason, JSON.stringify(res.body));
    return res.body.error.details;
  };

  const signUp = async (firstName, lastName, extra = {}) => {
    const account = await ok(
      api.post('/api/v1/auth/register').send({
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.test`,
        password: 'Password123!',
        firstName,
        lastName,
        ...APPLICATION_FIELDS,
        gradeLevel: 7,
        ...extra,
      }),
      201,
    );
    return { ...account, auth: bearer(account.firebaseUid) };
  };
  const nextClass = (who) => ok(api.get('/api/v1/enrollments/next-class').set(as(who)));
  const pickSection = (who, klass) =>
    ok(api.post('/api/v1/enrollments/next-class').set(as(who)).send({ classId: klass.id }), 201);

  /** `{ ana: 'present', ben: 'absent' }` -> `[[anaStudentId, 'present'], [benStudentId, 'absent']]`, by id. */
  const byStudentId = (byName) =>
    Object.entries(byName)
      .map(([name, value]) => [kids[name].studentId, value])
      .sort((a, b) => a[0] - b[0]);
  /** Saves a lesson's sheet; `marks` maps a student's name to a status. */
  const saveSheet = (classSubject, date, marks) =>
    api
      .put('/api/v1/attendance/sheet')
      .set(as(teacher))
      .send({
        classSubjectId: classSubject.id,
        date,
        records: byStudentId(marks).map(([studentId, status]) => ({ studentId, status })),
      });
  /** Marks a lesson's sheet; the clock is moved to that day first, as a teacher marks on the day. */
  const mark = async (classSubject, date, marks) => {
    on(date);
    const sheet = await ok(saveSheet(classSubject, date, marks));
    const saved = sheet.records
      .filter((row) => row.status !== null)
      .map((row) => [row.studentId, row.status]);
    assert.deepEqual(
      saved.sort((a, b) => a[0] - b[0]),
      byStudentId(marks),
    );
  };

  /**
   * Creates an assessment dated `date` (the clock moved there first) and records the scores, which map a
   * student's name to a score; a student of the class left out has a blank.
   */
  const assess = async (classSubject, date, fields, scores) => {
    on(date);
    const assessment = await ok(
      api
        .post('/api/v1/assessments')
        .set(as(teacher))
        .send({ classSubjectId: classSubject.id, assessedOn: date, ...fields }),
      201,
    );
    await ok(
      api
        .put(`/api/v1/assessments/${assessment.id}/grades`)
        .set(as(teacher))
        .send({ grades: byStudentId(scores).map(([studentId, score]) => ({ studentId, score })) }),
    );
    return assessment;
  };

  const summary = (who, query) => ok(api.get('/api/v1/grades/summary').query(query).set(as(who)));
  /** A student's per-class-subject rows: the quarters of a semester, or the semesters of the year. */
  const myRows = async (kid, semester) =>
    (await summary(kid, { studentId: 'me', academicYear: YEAR, ...(semester && { semester }) })).map(
      (row) => ({
        subject: `${row.className} · ${row.subjectName}`,
        ...(semester ? { quarters: row.quarters } : { semesters: row.semesters }),
        percentage: row.percentage,
      }),
    );
  /** The general average of every student for the period, as the office reads it: studentId -> percentage. */
  const generalAverages = async (query) =>
    Object.fromEntries(
      (await summary(admin, { groupBy: 'student', ...query })).map((row) => [row.studentId, row.percentage]),
    );
  const atRisk = async () => (await ok(api.get('/api/v1/dashboard').set(as(admin)))).atRisk;
  const statement = (who, kid, academicYear) =>
    ok(api.get('/api/v1/fees/statement').query({ studentId: kid, academicYear }).set(as(who)));

  before(async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2030-08-01T09:00:00Z') });
    await resetWorld();
  });

  after(() => mock.timers.reset());

  it('2030-08-01: the office sets up the year: subjects, two sections, a teacher, the timetable and fees', async () => {
    on('2030-08-01');
    admin = await makeUser('admin');
    teacher = await makeUser('teacher', { firstName: 'Teresa', lastName: 'Aquino' });
    math = await makeSubject(admin, { code: 'MATH7', name: 'Mathematics 7', gradingGroup: 'math_science' });
    values = await makeSubject(admin, { code: 'VAL7', name: 'Values Education 7' });
    assert.deepEqual(
      [math.gradingGroup, values.gradingGroup, values.gradeWeights],
      ['math_science', null, null],
    );
    rizal = await makeClass(admin, { name: 'Grade 7 - Rizal', gradeLevel: 7, academicYear: YEAR });
    bonifacio = await makeClass(admin, { name: 'Grade 7 - Bonifacio', gradeLevel: 7, academicYear: YEAR });
    const teach = (klass, subject) =>
      assignTeacher(admin, { classId: klass.id, subjectId: subject.id, teacherId: teacher.teacherId });
    cs.rizalMath = await teach(rizal, math);
    cs.rizalValues = await teach(rizal, values);
    cs.bonifacioMath = await teach(bonifacio, math);
    cs.bonifacioValues = await teach(bonifacio, values);

    // Mathematics meets on Mondays and Wednesdays, Values on Tuesdays; one teacher, so the sections take turns.
    const slots = [
      [cs.rizalMath, 1, '08:00', '09:00'],
      [cs.rizalMath, 3, '08:00', '09:00'],
      [cs.bonifacioMath, 1, '09:00', '10:00'],
      [cs.bonifacioMath, 3, '09:00', '10:00'],
      [cs.rizalValues, 2, '08:00', '09:00'],
      [cs.bonifacioValues, 2, '09:00', '10:00'],
    ];
    for (const [classSubject, dayOfWeek, startTime, endTime] of slots) {
      await ok(
        api
          .post('/api/v1/schedules')
          .set(as(admin))
          .send({ classSubjectId: classSubject.id, dayOfWeek, startTime, endTime }),
        201,
      );
    }
    await ok(
      api
        .post('/api/v1/calendar-events')
        .set(as(admin))
        .send({ title: 'National Heroes Day', type: 'holiday', startsOn: '2030-08-26' }),
      201,
    );
    const fee = (body) => ok(api.post('/api/v1/fees').set(as(admin)).send(body), 201);
    await fee({ academicYear: YEAR, name: 'Tuition', amount: 12000 });
    await fee({ academicYear: YEAR, gradeLevel: 7, name: 'Miscellaneous', amount: 2500.5 });
    await fee({ academicYear: YEAR, gradeLevel: 8, name: 'Miscellaneous', amount: 2600 }); // not Grade 7's
  });

  it('2030-08-05: students sign up and pick their own section; one never does', async () => {
    on('2030-08-05');
    kids.ana = await signUp('Ana', 'Reyes');
    kids.ben = await signUp('Ben', 'Santos');
    kids.carla = await signUp('Carla', 'Cruz', { lrn: '136512340001' });
    kids.dan = await signUp('Dan', 'Lim');
    kids.eve = await signUp('Eve', 'Tan');

    const standing = await nextClass(kids.ana);
    assert.equal(standing.status, 'new');
    assert.deepEqual([standing.gradeLevel, standing.academicYear], [7, YEAR]);
    assert.deepEqual(
      standing.classes.map((klass) => klass.name),
      ['Grade 7 - Bonifacio', 'Grade 7 - Rizal'],
    );
    for (const kid of [kids.ana, kids.ben, kids.carla]) await pickSection(kid, rizal);
    const dan = await pickSection(kids.dan, bonifacio);
    assert.deepEqual(
      [dan.class.name, dan.enrolledOn, dan.status],
      ['Grade 7 - Bonifacio', '2030-08-05', 'active'],
    );
    // Eve looks and leaves it: the head counts are there for her to see.
    const eve = await nextClass(kids.eve);
    assert.deepEqual(
      eve.classes.map((klass) => [klass.name, klass.enrolled, klass.seats]),
      [
        ['Grade 7 - Bonifacio', 1, 35],
        ['Grade 7 - Rizal', 3, 35],
      ],
    );

    const pay = (kid, amount, paidOn, receiptNumber) =>
      ok(
        api.post('/api/v1/payments').set(as(admin)).send({
          studentId: kid.studentId,
          academicYear: YEAR,
          amount,
          paidOn,
          method: 'cash',
          receiptNumber,
        }),
        201,
      );
    await pay(kids.ana, 5000, '2030-08-05', 'OR-2030-0001');
    await pay(kids.ben, 7000, '2030-08-05', 'OR-2030-0002');
  });

  it('August: attendance on lesson days; a day without the lesson, a future day and a holiday are refused', async () => {
    await mark(cs.rizalMath, '2030-08-05', { ana: P, ben: P, carla: P });
    await mark(cs.bonifacioMath, '2030-08-05', { dan: P });
    await mark(cs.rizalValues, '2030-08-06', { ana: P, ben: A, carla: P });
    await mark(cs.bonifacioValues, '2030-08-06', { dan: P });
    await mark(cs.rizalMath, '2030-08-07', { ana: P, ben: A, carla: P });
    await mark(cs.bonifacioMath, '2030-08-07', { dan: P });
    await mark(cs.rizalMath, '2030-08-12', { ana: P, ben: L, carla: L });
    await mark(cs.bonifacioMath, '2030-08-12', { dan: A });
    // Values does not meet on Mondays: no lesson took place, so nobody can be marked absent from it.
    const noLesson = await refused(
      saveSheet(cs.rizalValues, '2030-08-12', { ana: P }),
      400,
      'no_lesson_on_day',
    );
    assert.deepEqual(noLesson.lessonDays, [2]);
    await mark(cs.rizalValues, '2030-08-13', { ana: P, ben: P, carla: P });
    await mark(cs.rizalMath, '2030-08-14', { ana: P, ben: A, carla: P });
    await mark(cs.rizalMath, '2030-08-19', { ana: P, ben: A, carla: P });
    await mark(cs.rizalValues, '2030-08-20', { ana: P, ben: E, carla: E });
    await mark(cs.rizalMath, '2030-08-21', { ana: P, ben: P, carla: P });
    await refused(saveSheet(cs.rizalMath, '2030-08-28', { ana: P }), 400, 'future_date');
    on('2030-08-26');
    await refused(saveSheet(cs.rizalMath, '2030-08-26', { ana: P }), 400, 'school_holiday');
  });

  it('1st Semester, 1st Quarter: assessments in both sections, blank scores counting 0', async () => {
    const q1 = { semester: 'sem1', term: 'term1' };
    const reflection = { ...q1, title: 'Reflection 1', type: 'assignment', maxScore: 10 };
    await assess(cs.rizalValues, '2030-08-27', reflection, { ana: 9, ben: 8, carla: 7 });
    await assess(cs.bonifacioValues, '2030-08-27', reflection, { dan: 8 });
    const quiz = { ...q1, title: 'Quiz 1', type: 'quiz', maxScore: 20 };
    await assess(cs.rizalMath, '2030-08-28', quiz, { ana: 18, ben: 10, carla: 16 });
    await assess(cs.bonifacioMath, '2030-08-28', quiz, { dan: 15 });
    // Ben hands in no project: once his classmates have scores, his blank counts 0.
    const project = { ...q1, title: 'Project 1', type: 'project', maxScore: 50 };
    await assess(cs.rizalMath, '2030-09-04', project, { ana: 45, carla: 40 });
    const valuesQuiz = { ...q1, title: 'Quiz 1', type: 'quiz', maxScore: 15 };
    await assess(cs.rizalValues, '2030-09-10', valuesQuiz, { ana: 14, ben: 12, carla: 12 });
    await assess(cs.bonifacioValues, '2030-09-10', valuesQuiz, { dan: 12 });
    const exam = { ...q1, title: 'Q1 Exam', type: 'exam', maxScore: 50 };
    await assess(cs.rizalMath, '2030-09-25', exam, { ana: 40, ben: 25, carla: 35 });
    await assess(cs.bonifacioMath, '2030-09-25', exam, { dan: 42 });

    // Ben's Mathematics: written 10/20 = 50 %, performance 0/50 = 0 % (the blank), quarterly 25/50 = 50 %:
    // (50*40 + 0*40 + 50*20) / 100 = 30.00, below 60, so 60 + floor(30.00 / 4) = 67.
    on('2030-09-30');
    const [benMath] = (
      await summary(admin, { studentId: kids.ben.studentId, academicYear: YEAR, semester: 'sem1' })
    ).filter((row) => row.subjectId === math.id);
    assert.deepEqual(
      [benMath.initialGrade, benMath.percentage, benMath.components.map((part) => part.percentage)],
      [30, 67, [50, 0, 50]],
    );
  });

  it('2030-09-30: the dashboard flags the student below the attendance and grade lines so far', async () => {
    on('2030-09-30');
    // General averages so far (each subject's 1st Quarter is all there is): Ana (92 + 92.00) / 2 = 92,
    // Ben (67 + 80.00) / 2 = 73.5, Carla (86 + 76.00) / 2 = 81, Dan (86 + 80.00) / 2 = 83.
    const { ana, ben, carla, dan } = kids;
    assert.deepEqual(await generalAverages({ academicYear: YEAR }), {
      [ana.studentId]: 92,
      [ben.studentId]: 73.5,
      [carla.studentId]: 81,
      [dan.studentId]: 83,
    });
    // Ben: 3 present + 1 late of 9 marks = 0.4444. Dan: 3 of 4 = 0.75, but under 5 marks nobody is judged.
    const list = await atRisk();
    assert.equal(list.total, 1);
    assert.deepEqual(
      list.students.map((row) => [
        row.studentId,
        row.className,
        row.attendance,
        row.gradeAverage,
        row.reasons,
      ]),
      [[ben.studentId, 'Grade 7 - Rizal', { rate: 0.4444, marks: 9 }, 73.5, ['attendance', 'grades']]],
    );
  });

  it('1st Semester, 2nd Quarter: a quarter without a performance task', async () => {
    const q2 = { semester: 'sem1', term: 'term2' };
    // Ana forgets her essay: 0 of 20, a strong student's blank counts like anyone's.
    const essay = { ...q2, title: 'Essay 1', type: 'assignment', maxScore: 20 };
    await assess(cs.rizalValues, '2030-10-08', essay, { ben: 15, carla: 18 });
    const quiz = { ...q2, title: 'Quiz 2', type: 'quiz', maxScore: 25 };
    await assess(cs.rizalMath, '2030-10-09', quiz, { ana: 25, ben: 15, carla: 20 });
    const valuesQuiz = { ...q2, title: 'Quiz 2', type: 'quiz', maxScore: 20 };
    await assess(cs.rizalValues, '2030-11-12', valuesQuiz, { ana: 19, ben: 14, carla: 17 });
    const exam = { ...q2, title: 'Q2 Exam', type: 'exam', maxScore: 40 };
    await assess(cs.rizalMath, '2030-11-13', exam, { ana: 34, ben: 22, carla: 30 });
  });

  it('2031-01-20: a student moves to the other section; each sheet then takes her from her own day on', async () => {
    on('2031-01-13');
    await ok(
      api.post('/api/v1/payments').set(as(admin)).send({
        studentId: kids.ben.studentId,
        academicYear: YEAR,
        amount: 7500.5,
        paidOn: '2031-01-13',
        method: 'bank',
        receiptNumber: 'OR-2031-0003',
      }),
      201,
    );
    const s2q1 = { semester: 'sem2', term: 'term1' };
    // The same titles as in the 1st Semester: the period is part of an assessment's name.
    const reflection = { ...s2q1, title: 'Reflection 1', type: 'assignment', maxScore: 10 };
    await assess(cs.rizalValues, '2031-01-14', reflection, { ana: 10, ben: 6, carla: 9 });
    await assess(cs.bonifacioValues, '2031-01-14', reflection, { dan: 7 });
    const quiz = { ...s2q1, title: 'Quiz 1', type: 'quiz', maxScore: 20 };
    await assess(cs.rizalMath, '2031-01-15', quiz, { ana: 20, ben: 12, carla: 14 });
    const bonifacioQuiz = await assess(cs.bonifacioMath, '2031-01-15', quiz, { dan: 16 });

    on('2031-01-20');
    const moved = await ok(
      api
        .post('/api/v1/enrollments/transfer')
        .set(as(admin))
        .send({ studentId: kids.carla.studentId, classId: bonifacio.id }),
      201,
    );
    assert.deepEqual([moved.class.name, moved.enrolledOn], ['Grade 7 - Bonifacio', '2031-01-20']);

    await mark(cs.bonifacioMath, '2031-01-22', { dan: P, carla: P });
    const marks = { ana: P, ben: A, carla: P };
    const notInRizal = await refused(saveSheet(cs.rizalMath, '2031-01-22', marks), 400, 'not_enrolled');
    assert.deepEqual(notInRizal.invalidStudentIds, [kids.carla.studentId]);
    await mark(cs.rizalMath, '2031-01-22', { ana: P, ben: A });
    // Bonifacio's quiz was given before she came: she cannot be graded on it, and it is not held against her.
    on('2031-01-29');
    await refused(
      api
        .put(`/api/v1/assessments/${bonifacioQuiz.id}/grades`)
        .set(as(teacher))
        .send({ grades: [{ studentId: kids.carla.studentId, score: 0 }] }),
      400,
      'not_enrolled',
    );
  });

  it('2nd Semester: assessments in both sections, the transferee graded in her new one', async () => {
    const s2q1 = { semester: 'sem2', term: 'term1' };
    const project = { ...s2q1, title: 'Project 1', type: 'project', maxScore: 40 };
    await assess(cs.bonifacioMath, '2031-01-29', project, { dan: 36, carla: 30 });
    const valuesQuiz = { ...s2q1, title: 'Quiz 1', type: 'quiz', maxScore: 10 };
    await assess(cs.rizalValues, '2031-02-04', valuesQuiz, { ana: 9, ben: 8 });
    await assess(cs.bonifacioValues, '2031-02-04', valuesQuiz, { dan: 9, carla: 8 });
    const exam = { ...s2q1, title: 'Q1 Exam', type: 'exam', maxScore: 50 };
    await assess(cs.rizalMath, '2031-02-12', exam, { ana: 45, ben: 30 });
    await assess(cs.bonifacioMath, '2031-02-12', exam, { dan: 40, carla: 38 });
    const valuesProject = {
      semester: 'sem2',
      term: 'term2',
      title: 'Project 1',
      type: 'project',
      maxScore: 30,
    };
    await assess(cs.rizalValues, '2031-03-04', valuesProject, { ana: 29, ben: 24 });
    await assess(cs.bonifacioValues, '2031-03-04', valuesProject, { dan: 27, carla: 21 });
  });

  it("2031-07-15: each student's quarterly, semester and year grades", async () => {
    on('2031-07-15');
    const RIZAL_MATH = 'Grade 7 - Rizal · Mathematics 7';
    const RIZAL_VALUES = 'Grade 7 - Rizal · Values Education 7';
    const BONIFACIO_MATH = 'Grade 7 - Bonifacio · Mathematics 7';
    const BONIFACIO_VALUES = 'Grade 7 - Bonifacio · Values Education 7';
    const { ana, ben, carla, dan } = kids;

    // Ana. Mathematics Q1: written 18/20 = 90, performance 45/50 = 90, quarterly 40/50 = 80 -> 88.00 ->
    // 75 + floor(28 / 1.6) = 92. Q2 (no performance task): (100*40 + 85*20) / 60 = 95.00 -> 96. 1st Semester
    // (92 + 96) / 2 = 94. 2nd Semester Q1: (100*40 + 90*20) / 60 = 96.67 -> 97. Year (94 + 97) / 2 = 95.5 -> 96.
    // Values: 23/25 = 92.00; (0 + 19)/40 = 47.50 (the blank essay); 1st Semester 69.75. 19/20 = 95.00 and
    // 29/30 = 96.67 -> 95.835 -> 95.84. Year (69.75 + 95.84) / 2 = 82.795 -> 82.80.
    assert.deepEqual(await myRows(ana, 'sem1'), [
      { subject: RIZAL_MATH, quarters: quarters(92, 96), percentage: 94 },
      { subject: RIZAL_VALUES, quarters: quarters(92, 47.5), percentage: 69.75 },
    ]);
    assert.deepEqual(await myRows(ana, 'sem2'), [
      { subject: RIZAL_MATH, quarters: quarters(97), percentage: 97 },
      { subject: RIZAL_VALUES, quarters: quarters(95, 96.67), percentage: 95.84 },
    ]);
    assert.deepEqual(await myRows(ana), [
      { subject: RIZAL_MATH, semesters: semesters(94, 97), percentage: 96 },
      { subject: RIZAL_VALUES, semesters: semesters(69.75, 95.84), percentage: 82.8 },
    ]);

    // Ben. Mathematics Q1 67 (see above); Q2 (60*40 + 55*20) / 60 = 58.33 -> 60 + floor(58.33 / 4) = 74;
    // 1st Semester 70.5 -> 71. 2nd Semester Q1 (60*40 + 60*20) / 60 = 60.00 -> exactly 75. Year 73: failed.
    // Values 20/25 = 80.00, 29/40 = 72.50 -> 76.25; 14/20 = 70.00, 24/30 = 80.00 -> 75.00; year 75.625 -> 75.63.
    assert.deepEqual(await myRows(ben, 'sem1'), [
      { subject: RIZAL_MATH, quarters: quarters(67, 74), percentage: 71 },
      { subject: RIZAL_VALUES, quarters: quarters(80, 72.5), percentage: 76.25 },
    ]);
    assert.deepEqual(await myRows(ben, 'sem2'), [
      { subject: RIZAL_MATH, quarters: quarters(75), percentage: 75 },
      { subject: RIZAL_VALUES, quarters: quarters(70, 80), percentage: 75 },
    ]);
    assert.deepEqual(await myRows(ben), [
      { subject: RIZAL_MATH, semesters: semesters(71, 75), percentage: 73 },
      { subject: RIZAL_VALUES, semesters: semesters(76.25, 75), percentage: 75.63 },
    ]);

    // Carla, one row per class. Rizal: Mathematics Q1 78.00 -> 86, Q2 78.33 -> 86; Values 19/25 = 76.00 and
    // 35/40 = 87.50 -> 81.75. 2nd Semester Q1 in Rizal (until 2031-01-20): the quiz alone, 14/20 = 70.00 -> 81;
    // the reflection 9/10 = 90.00. In Bonifacio, not the quiz or the reflection given before she came:
    // (30/40 = 75 * 40 + 38/50 = 76 * 20) / 60 = 75.33 -> 84; Values 8/10 = 80.00 and 21/30 = 70.00 -> 75.00.
    assert.deepEqual(await myRows(carla, 'sem1'), [
      { subject: RIZAL_MATH, quarters: quarters(86, 86), percentage: 86 },
      { subject: RIZAL_VALUES, quarters: quarters(76, 87.5), percentage: 81.75 },
    ]);
    assert.deepEqual(await myRows(carla, 'sem2'), [
      { subject: BONIFACIO_MATH, quarters: quarters(84), percentage: 84 },
      { subject: BONIFACIO_VALUES, quarters: quarters(80, 70), percentage: 75 },
      { subject: RIZAL_MATH, quarters: quarters(81), percentage: 81 },
      { subject: RIZAL_VALUES, quarters: quarters(90), percentage: 90 },
    ]);
    assert.deepEqual(await myRows(carla), [
      { subject: BONIFACIO_MATH, semesters: semesters(null, 84), percentage: 84 },
      { subject: BONIFACIO_VALUES, semesters: semesters(null, 75), percentage: 75 },
      { subject: RIZAL_MATH, semesters: semesters(86, 81), percentage: 84 },
      { subject: RIZAL_VALUES, semesters: semesters(81.75, 90), percentage: 85.88 },
    ]);

    // Dan. Mathematics Q1 (75*40 + 84*20) / 60 = 78.00 -> 86; 2nd Semester Q1 (80*40 + 90*40 + 80*20) / 100 =
    // exactly 84.00 -> 75 + 24 / 1.6 = 90; year 88. Values 20/25 = 80.00; 16/20 = 80.00 and 27/30 = 90.00 -> 85.
    assert.deepEqual(await myRows(dan, 'sem1'), [
      { subject: BONIFACIO_MATH, quarters: quarters(86), percentage: 86 },
      { subject: BONIFACIO_VALUES, quarters: quarters(80), percentage: 80 },
    ]);
    assert.deepEqual(await myRows(dan, 'sem2'), [
      { subject: BONIFACIO_MATH, quarters: quarters(90), percentage: 90 },
      { subject: BONIFACIO_VALUES, quarters: quarters(80, 90), percentage: 85 },
    ]);
    assert.deepEqual(await myRows(dan), [
      { subject: BONIFACIO_MATH, semesters: semesters(86, 90), percentage: 88 },
      { subject: BONIFACIO_VALUES, semesters: semesters(80, 85), percentage: 82.5 },
    ]);
  });

  it('2031-07-15: general averages of the year and of each semester, the transferee as one student', async () => {
    const { ana, ben, carla, dan } = kids;
    // Carla's subjects put together quarter by quarter: Mathematics 2nd Semester Q1 (81 + 84) / 2 = 82.5 -> 83,
    // year (86 + 83) / 2 = 84.5 -> 85; Values Q1 (90 + 80) / 2 = 85.00, Q2 70.00 -> 77.50, year
    // (81.75 + 77.50) / 2 = 79.625 -> 79.63. Year averages: Ana (96 + 82.80) / 2 = 89.40, Ben (73 + 75.63) / 2 =
    // 74.315 -> 74.32, Carla (85 + 79.63) / 2 = 82.315 -> 82.32, Dan (88 + 82.50) / 2 = 85.25.
    assert.deepEqual(await generalAverages({ academicYear: YEAR }), {
      [ana.studentId]: 89.4,
      [ben.studentId]: 74.32,
      [carla.studentId]: 82.32,
      [dan.studentId]: 85.25,
    });
    // 1st Semester: (94 + 69.75) / 2 = 81.875 -> 81.88, (71 + 76.25) / 2 = 73.625 -> 73.63,
    // (86 + 81.75) / 2 = 83.875 -> 83.88, (86 + 80) / 2 = 83.
    assert.deepEqual(await generalAverages({ academicYear: YEAR, semester: 'sem1' }), {
      [ana.studentId]: 81.88,
      [ben.studentId]: 73.63,
      [carla.studentId]: 83.88,
      [dan.studentId]: 83,
    });
    // 2nd Semester: (97 + 95.84) / 2 = 96.42, (75 + 75) / 2 = 75, (83 + 77.50) / 2 = 80.25, (90 + 85) / 2 = 87.5.
    assert.deepEqual(await generalAverages({ academicYear: YEAR, semester: 'sem2' }), {
      [ana.studentId]: 96.42,
      [ben.studentId]: 75,
      [carla.studentId]: 80.25,
      [dan.studentId]: 87.5,
    });
  });

  it('2031-07-15: attendance rates over the year', async () => {
    const { ana, ben, carla, dan } = kids;
    const rows = await ok(
      api
        .get('/api/v1/attendance/summary')
        .query({ groupBy: 'student', dateFrom: '2030-08-01', dateTo: '2031-07-31' })
        .set(as(admin)),
    );
    const counts = ({ studentId, total, present, absent, late, excused, rate }) => [
      studentId,
      { total, present, absent, late, excused, rate },
    ];
    // Carla's late and excused marks: (8 + 1) / 10. Dan exactly on the 80 % line: 4 / 5.
    assert.deepEqual(Object.fromEntries(rows.map(counts)), {
      [ana.studentId]: { total: 10, present: 10, absent: 0, late: 0, excused: 0, rate: 1 },
      [ben.studentId]: { total: 10, present: 3, absent: 5, late: 1, excused: 1, rate: 0.4 },
      [carla.studentId]: { total: 10, present: 8, absent: 0, late: 1, excused: 1, rate: 0.9 },
      [dan.studentId]: { total: 5, present: 4, absent: 1, late: 0, excused: 0, rate: 0.8 },
    });
    const own = await ok(api.get('/api/v1/attendance/summary').query({ studentId: 'me' }).set(as(ben)));
    assert.deepEqual(own, { total: 10, present: 3, absent: 5, late: 1, excused: 1, rate: 0.4 });
  });

  it('2031-07-15: the at-risk list on the admin dashboard', async () => {
    const list = await atRisk();
    assert.deepEqual(
      [list.attendanceRateBelow, list.minAttendanceMarks, list.gradeAverageBelow, list.total],
      [0.8, 5, 75, 1],
    );
    // Dan sits exactly on the 80 % line, which is not below it; nobody else is under either line.
    assert.deepEqual(list.students, [
      {
        studentId: kids.ben.studentId,
        studentNumber: kids.ben.profile.studentNumber,
        firstName: 'Ben',
        lastName: 'Santos',
        classId: rizal.id,
        className: 'Grade 7 - Rizal',
        attendance: { rate: 0.4, marks: 10 },
        gradeAverage: 74.32,
        reasons: ['attendance', 'grades'],
      },
    ]);
  });

  it("2031-07-15: the teacher's dashboard: the same list, and only the two real blanks still to grade", async () => {
    const mine = await ok(api.get('/api/v1/dashboard').set(as(teacher)));
    assert.deepEqual(mine.atRisk, await atRisk(), 'the teacher teaches both sections');
    // Ben's project and Ana's essay lack a score; Bonifacio's 2nd Semester quiz, given before Carla came, is
    // complete without hers, and the Rizal exam given after she left does not wait for her.
    assert.deepEqual(
      mine.pendingGrading.map((row) => [
        row.title,
        row.className,
        row.subjectName,
        row.assessedOn,
        row.graded,
        row.enrolled,
      ]),
      [
        ['Essay 1', 'Grade 7 - Rizal', 'Values Education 7', '2030-10-08', 2, 3],
        ['Project 1', 'Grade 7 - Rizal', 'Mathematics 7', '2030-09-04', 2, 3],
      ],
    );
  });

  it("2031-07-15: the report card data: the student's LRN and class, and both classes' quarters", async () => {
    const me = await ok(api.get('/api/v1/auth/me').set(as(kids.carla)));
    assert.equal(me.profile.lrn, '136512340001');
    assert.equal(me.currentEnrollment.className, 'Grade 7 - Bonifacio');
    // The printed card is built from these rows (one request per semester, as the student page makes them):
    // the 2nd Semester has a row per class, which the card puts on one line per subject.
    const rows = await summary(kids.carla, { studentId: 'me', academicYear: YEAR, semester: 'sem2' });
    assert.deepEqual(
      rows.map((row) => [row.className, row.subjectName, row.method, row.quarters.term1, row.quarters.term2]),
      [
        ['Grade 7 - Bonifacio', 'Mathematics 7', 'k12', 84, null],
        ['Grade 7 - Bonifacio', 'Values Education 7', 'points', 80, 70],
        ['Grade 7 - Rizal', 'Mathematics 7', 'k12', 81, null],
        ['Grade 7 - Rizal', 'Values Education 7', 'points', 90, null],
      ],
    );
    // A K-12 quarter shows its initial grade before transmutation; Bonifacio's quiz is not in it.
    assert.deepEqual(
      rows[0].components.map((part) => [part.component, part.percentage, part.assessmentsGraded]),
      [
        ['written', null, 0],
        ['performance', 75, 1],
        ['quarterly', 76, 1],
      ],
    );
    assert.equal(rows[0].initialGrade, 75.33);
  });

  it('2031-07-15: fees owed, only for a year with a class', async () => {
    const { ana, ben, carla, eve } = kids;
    const grade7Fees = [
      { name: 'Miscellaneous', gradeLevel: 7, amount: 2500.5 },
      { name: 'Tuition', gradeLevel: null, amount: 12000 },
    ];
    const brief = (s) => ({
      class: s.class && s.class.name,
      fees: s.fees.map(({ name, gradeLevel, amount }) => ({ name, gradeLevel, amount })),
      totalFees: s.totalFees,
      totalPaid: s.totalPaid,
      balance: s.balance,
    });
    assert.deepEqual(brief(await statement(admin, ana.studentId, YEAR)), {
      class: 'Grade 7 - Rizal',
      fees: grade7Fees,
      totalFees: 14500.5,
      totalPaid: 5000,
      balance: 9500.5,
    });
    assert.deepEqual(brief(await statement(admin, ben.studentId, YEAR)), {
      class: 'Grade 7 - Rizal',
      fees: grade7Fees,
      totalFees: 14500.5,
      totalPaid: 14500.5,
      balance: 0,
    });
    // The transferee pays as a student of the class she was in last that year.
    assert.deepEqual(brief(await statement(admin, carla.studentId, YEAR)), {
      class: 'Grade 7 - Bonifacio',
      fees: grade7Fees,
      totalFees: 14500.5,
      totalPaid: 0,
      balance: 14500.5,
    });
    // Eve never took a seat: nothing is charged, not even the every-grade tuition.
    assert.deepEqual(brief(await statement(eve, 'me', YEAR)), {
      class: null,
      fees: [],
      totalFees: 0,
      totalPaid: 0,
      balance: 0,
    });
  });

  it('2031-07-15: End of school year: passed every subject -> Grade 8; one failed subject -> remedial', async () => {
    const { ana, ben, carla, dan } = kids;
    grade8 = await makeClass(admin, { name: 'Grade 8 - Mabini', gradeLevel: 8, academicYear: NEXT_YEAR });
    await ok(
      api
        .post('/api/v1/fees')
        .set(as(admin))
        .send({ academicYear: NEXT_YEAR, name: 'Tuition', amount: 13000 }),
      201,
    );
    await ok(
      api
        .post('/api/v1/fees')
        .set(as(admin))
        .send({ academicYear: NEXT_YEAR, gradeLevel: 8, name: 'Miscellaneous', amount: 2750.25 }),
      201,
    );
    const complete = (klass, students) =>
      ok(
        api
          .post('/api/v1/enrollments/complete')
          .set(as(admin))
          .send({ classId: klass.id, studentIds: students.map((kid) => kid.studentId) }),
      );
    assert.deepEqual(
      [(await complete(rizal, [ana, ben])).completed, (await complete(bonifacio, [carla, dan])).completed],
      [2, 2],
    );

    const lastClass = (klass) => ({ id: klass.id, name: klass.name, gradeLevel: 7, academicYear: YEAR });
    const brief = (s) => ({
      status: s.status,
      lastClass: s.lastClass,
      generalAverage: s.generalAverage,
      failedSubjects: s.failedSubjects,
      gradeLevel: s.gradeLevel,
      academicYear: s.academicYear,
      classes: s.classes.map((klass) => [klass.id, klass.enrolled, klass.seats]),
    });
    const promoted = (klass, generalAverage) => ({
      status: 'promoted',
      lastClass: lastClass(klass),
      generalAverage,
      failedSubjects: [],
      gradeLevel: 8,
      academicYear: NEXT_YEAR,
      classes: [[grade8.id, 0, 35]],
    });
    assert.deepEqual(brief(await nextClass(ana)), promoted(rizal, 89.4));
    assert.deepEqual(brief(await nextClass(carla)), promoted(bonifacio, 82.32));
    assert.deepEqual(brief(await nextClass(dan)), promoted(bonifacio, 85.25));
    assert.deepEqual(brief(await nextClass(ben)), {
      status: 'remedial',
      lastClass: lastClass(rizal),
      generalAverage: 74.32,
      failedSubjects: [{ subjectId: math.id, subjectName: 'Mathematics 7', percentage: 73 }],
      gradeLevel: null,
      academicYear: null,
      classes: [],
    });
    await refused(
      api.post('/api/v1/enrollments/next-class').set(as(ben)).send({ classId: grade8.id }),
      409,
      'not_eligible',
    );
  });

  it('2031-08-04: the next school year starts clean', async () => {
    on('2031-08-04');
    const { ana, ben, carla, dan } = kids;
    for (const kid of [ana, carla, dan]) {
      const enrollment = await pickSection(kid, grade8);
      assert.deepEqual([enrollment.class.name, enrollment.enrolledOn], ['Grade 8 - Mabini', '2031-08-04']);
    }
    assert.equal((await nextClass(ana)).status, 'enrolled');

    const dashboard = await ok(api.get('/api/v1/dashboard').set(as(admin)));
    assert.deepEqual(dashboard.atRisk.students, []);
    assert.equal(dashboard.atRisk.total, 0);
    assert.deepEqual(
      [dashboard.counts.classes, dashboard.counts.activeEnrollments, dashboard.counts.unenrolledStudents],
      [1, 3, 2],
      "this year's one class, its three students, and Ben and Eve without a class",
    );
    assert.deepEqual(dashboard.enrollmentsByGrade, [{ gradeLevel: 8, students: 3 }]);

    const mine = await ok(api.get('/api/v1/dashboard').set(as(ana)));
    assert.deepEqual(
      [mine.currentEnrollment.className, mine.currentEnrollment.academicYear, mine.gradeSummary],
      ['Grade 8 - Mabini', NEXT_YEAR, []],
    );
    assert.deepEqual(mine.attendanceSummary, {
      dateFrom: '2031-08-01',
      dateTo: '2031-08-04',
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      rate: null,
    });
    assert.deepEqual(await summary(ana, { studentId: 'me', academicYear: NEXT_YEAR }), []);

    // Last year stays as it was.
    assert.deepEqual(await generalAverages({ academicYear: YEAR }), {
      [ana.studentId]: 89.4,
      [ben.studentId]: 74.32,
      [carla.studentId]: 82.32,
      [dan.studentId]: 85.25,
    });
    const anaFees = await statement(ana, 'me', NEXT_YEAR);
    assert.deepEqual(
      [anaFees.class.name, anaFees.totalFees, anaFees.totalPaid, anaFees.balance],
      ['Grade 8 - Mabini', 15750.25, 0, 15750.25],
    );
    const benFees = await statement(admin, ben.studentId, NEXT_YEAR);
    assert.deepEqual([benFees.class, benFees.fees, benFees.totalFees], [null, [], 0]);
  });
});
