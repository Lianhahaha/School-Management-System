import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { academicYearStart, addDaysYmd, currentAcademicYear } from '../src/utils/dates.js';
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

/**
 * Two semesters a year, each with its own four quarters, through the API: an assessment belongs to a
 * (semester, quarter); a quarter is graded on its own, a semester's grade is the average of its quarterly
 * grades and the school year's grade the average of the semester grades that exist. Every figure built on a
 * subject's grade (the summary, results per student, the dashboards, the at-risk list) uses that year grade,
 * or the semester's grade when the request names a semester.
 */
describe('semesters', () => {
  let school;
  let csA2; // a second subject in classA, taught by `owner`
  const QUARTERS = (term1 = null, term2 = null, term3 = null, term4 = null) => ({
    term1,
    term2,
    term3,
    term4,
  });

  const newAssessment = async (classSubjectId, body, who = school.owner) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(who))
      .send({ classSubjectId, type: 'exam', maxScore: 100, ...body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const gradeSheet = async (assessment, scores, who = school.owner) => {
    const res = await api
      .put(`/api/v1/assessments/${assessment.id}/grades`)
      .set(as(who))
      .send({ grades: scores.map(([student, score]) => ({ studentId: student.studentId, score })) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  };
  const get = async (path, who = school.owner) => {
    const res = await api.get(path).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const summary = (params = '', who = school.owner) =>
    get(`/api/v1/grades/summary?classSubjectId=${school.csA.id}${params}`, who);
  const rowOf = (rows, student) => rows.find((row) => row.studentId === student.studentId);

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    csA2 = await assignTeacher(school.admin, {
      classId: school.classA.id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: school.owner.teacherId,
    });
    // csA is on points. s1: 1st Semester Q1 95, Q2 20 (2 / 10), Q3 65 -> 60; 2nd Semester Q1 100 -> year 80.
    // s2: 1st Semester Q1 to Q3 100 -> 100; 2nd Semester Q1 40 -> year 70. Over the four quarters s1 would
    // have 70 and s2 85: the other side of the 75 line for both.
    const exam1 = await newAssessment(school.csA.id, { title: 'Exam 1', semester: 'sem1', term: 'term1' });
    const quiz2 = await newAssessment(school.csA.id, {
      title: 'Quiz 2',
      type: 'quiz',
      maxScore: 10,
      semester: 'sem1',
      term: 'term2',
    });
    const test3 = await newAssessment(school.csA.id, {
      title: 'Test 3',
      type: 'test',
      semester: 'sem1',
      term: 'term3',
    });
    const second = await newAssessment(school.csA.id, { title: 'Exam 1', semester: 'sem2', term: 'term1' });
    await gradeSheet(exam1, [
      [school.s1, 95],
      [school.s2, 100],
    ]);
    await gradeSheet(quiz2, [
      [school.s1, 2],
      [school.s2, 10],
    ]);
    await gradeSheet(test3, [
      [school.s1, 65],
      [school.s2, 100],
    ]);
    await gradeSheet(second, [
      [school.s1, 100],
      [school.s2, 40],
    ]);
    // csA2: 1st Semester Q1 only, s1 90 and s2 70 (a blank score would count 0).
    await gradeSheet(await newAssessment(csA2.id, { title: 'Exam', semester: 'sem1', term: 'term1' }), [
      [school.s1, 90],
      [school.s2, 70],
    ]);
  });

  describe('assessments', () => {
    it('default to the 1st Semester, take the 2nd and refuse any other', async () => {
      const plain = await newAssessment(
        school.csB.id,
        { title: 'No semester given', term: 'term1' },
        school.other,
      );
      assert.equal(plain.semester, 'sem1');
      assert.equal(plain.term, 'term1');
      const later = await newAssessment(
        school.csB.id,
        { title: 'In the 2nd', semester: 'sem2', term: 'term2' },
        school.other,
      );
      assert.deepEqual([later.semester, later.term], ['sem2', 'term2']);

      const refused = await api.post('/api/v1/assessments').set(as(school.other)).send({
        classSubjectId: school.csB.id,
        title: 'Summer',
        type: 'quiz',
        semester: 'summer',
        term: 'term1',
        maxScore: 10,
      });
      assert.equal(refused.status, 400);
    });

    it('can be moved to the other semester, and say so in the activity log', async () => {
      const quiz = await newAssessment(
        school.csB.id,
        { title: 'Moves', type: 'quiz', maxScore: 10, term: 'term3' },
        school.other,
      );
      const moved = await api
        .patch(`/api/v1/assessments/${quiz.id}`)
        .set(as(school.other))
        .send({ semester: 'sem2' });
      assert.equal(moved.status, 200, JSON.stringify(moved.body));
      assert.deepEqual([moved.body.data.semester, moved.body.data.term], ['sem2', 'term3']);

      await api.patch(`/api/v1/assessments/${quiz.id}`).set(as(school.other)).send({ term: 'term4' });
      await api
        .patch(`/api/v1/assessments/${quiz.id}`)
        .set(as(school.other))
        .send({ semester: 'sem1', term: 'term1' });
      const entries = await get('/api/v1/activity?area=grades&limit=3', school.admin);
      assert.deepEqual(
        entries.map((entry) => entry.summary.replace(/ of .*$/, '')),
        ['Updated the semester and quarter', 'Updated the quarter', 'Updated the semester'],
        'the quarter is what `term` holds',
      );
      assert.deepEqual(entries[0].details.changes.semester, { from: 'sem2', to: 'sem1' });
    });

    it('filter by semester, and by quarter within it', async () => {
      const titles = async (params) =>
        (await get(`/api/v1/assessments?classSubjectId=${school.csA.id}${params}&sortBy=title`)).map(
          (assessment) => `${assessment.title}/${assessment.semester}/${assessment.term}`,
        );
      assert.deepEqual(await titles('&semester=sem2'), ['Exam 1/sem2/term1']);
      assert.deepEqual(await titles('&semester=sem1&term=term2'), ['Quiz 2/sem1/term2']);
      assert.deepEqual(await titles('&term=term1'), ['Exam 1/sem1/term1', 'Exam 1/sem2/term1']);
      assert.equal((await api.get('/api/v1/assessments?semester=sem3').set(as(school.owner))).status, 400);
    });

    it('allow the same title in the same quarter of the other semester only', async () => {
      // 'Exam 1' exists in the 1st Quarter of both semesters (the set-up above). A third in either is a 409
      // on the key that now includes the semester.
      for (const semester of ['sem1', 'sem2']) {
        const res = await api.post('/api/v1/assessments').set(as(school.owner)).send({
          classSubjectId: school.csA.id,
          title: 'Exam 1',
          type: 'exam',
          semester,
          term: 'term1',
          maxScore: 100,
        });
        assert.equal(res.status, 409, `${semester}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.error.details.key, 'assessments.uq_assessments_cs_period_title');
      }
      // The same title in another quarter is fine, and moving an assessment into a taken place is a 409.
      const fine = await newAssessment(school.csA.id, { title: 'Exam 1', semester: 'sem2', term: 'term3' });
      const clash = await api
        .patch(`/api/v1/assessments/${fine.id}`)
        .set(as(school.owner))
        .send({ term: 'term1' });
      assert.equal(clash.status, 409);
      assert.equal(clash.body.error.details.key, 'assessments.uq_assessments_cs_period_title');
      assert.equal((await api.delete(`/api/v1/assessments/${fine.id}`).set(as(school.owner))).status, 200);
    });

    it('carry their semester into the grades and the grade sheet', async () => {
      const grades = await get(
        `/api/v1/grades?studentId=${school.s1.studentId}&classSubjectId=${school.csA.id}&semester=sem2`,
      );
      assert.deepEqual(
        grades.map((entry) => [
          entry.assessment.title,
          entry.assessment.semester,
          entry.assessment.term,
          entry.score,
        ]),
        [['Exam 1', 'sem2', 'term1', 100]],
      );
      const roster = await get(
        `/api/v1/assessments/${(await get(`/api/v1/assessments?classSubjectId=${school.csA.id}&semester=sem2`))[0].id}/grades`,
      );
      assert.equal(roster.assessment.semester, 'sem2');
      assert.equal(
        (await api.get('/api/v1/grades?semester=sem3').set(as(school.admin))).status,
        400,
        'an unknown semester is refused',
      );
    });
  });

  describe('the summary', () => {
    it('gives the school year grade as the average of the semester grades, with the semesters', async () => {
      const [first] = (await summary('', school.s1)).filter((row) => row.classSubjectId === school.csA.id);
      assert.equal(first.method, 'points');
      assert.equal(first.percentage, 80); // (60 + 100) / 2; the mean of the four quarters is 70
      assert.deepEqual(first.semesters, { sem1: 60, sem2: 100 });
      assert.equal(first.quarters, undefined, 'the quarters are those of one semester');
      assert.equal(first.periods, undefined, 'the internal merge input stays inside');
      assert.equal(first.totalScore, 262, 'the points stay the plain sums of the period');
      assert.equal(first.totalMaxScore, 310);
      assert.equal(first.assessmentsGraded, 4);

      const second = rowOf(await summary('&groupBy=student'), school.s2);
      assert.equal(second.percentage, 70); // (100 + 40) / 2; the mean of the four quarters is 85
    });

    it('gives one semester on its own with its quarters', async () => {
      const [first] = await summary('&semester=sem1', school.s1);
      assert.equal(first.percentage, 60);
      assert.deepEqual(first.quarters, QUARTERS(95, 20, 65));
      assert.equal(first.semesters, undefined);
      assert.equal(first.totalScore, 162);

      const [second] = await summary('&semester=sem2', school.s1);
      assert.equal(second.percentage, 100);
      assert.deepEqual(second.quarters, QUARTERS(100));

      assert.deepEqual(await summary('&semester=sem2&term=term2', school.s1), []);
      const only = await summary('&semester=sem1&term=term2', school.s1);
      assert.deepEqual([only[0].percentage, only[0].quarters], [20, QUARTERS(null, 20)]);
    });

    it('averages the same quarter of both semesters when only the quarter is named', async () => {
      const [row] = await summary('&term=term1', school.s1);
      assert.deepEqual(row.semesters, { sem1: 95, sem2: 100 });
      assert.equal(row.percentage, 97.5);
    });

    it('rounds a K-12 semester to a whole number before the semesters are averaged', async () => {
      // A class of its own with a student of its own, so the general averages below stay as they are.
      const kid = await makeUser('student');
      const klass = await makeClass(school.admin);
      await enrollStudent(school.admin, { studentId: kid.studentId, classId: klass.id });
      const cs = await assignTeacher(school.admin, {
        classId: klass.id,
        subjectId: (await makeSubject(school.admin, { gradingGroup: 'languages' })).id,
        teacherId: school.owner.teacherId,
      });
      // Written work only (a quiz): each quarter's initial grade is the score, transmuted to 60-100.
      // 1st Semester Q1 18/20 = 90 -> 93, Q2 17/20 = 85 -> 90 (mean 91.5, a whole 92); 2nd Semester Q1
      // 16/20 = 80 -> 87. Year (92 + 87) / 2 = 89.5, a whole 90; unrounded semesters would give 89.25 (89).
      const quiz = async (title, semester, term, score) =>
        gradeSheet(await newAssessment(cs.id, { title, type: 'quiz', maxScore: 20, semester, term }), [
          [kid, score],
        ]);
      await quiz('K1', 'sem1', 'term1', 18);
      await quiz('K2', 'sem1', 'term2', 17);
      await quiz('K3', 'sem2', 'term1', 16);
      const [row] = await get(`/api/v1/grades/summary?classSubjectId=${cs.id}`);
      assert.equal(row.method, 'k12');
      assert.deepEqual(row.semesters, { sem1: 92, sem2: 87 });
      assert.equal(row.percentage, 90);
      assert.equal(row.initialGrade, null, 'several quarters were transmuted, each on its own');
      const [first] = await get(`/api/v1/grades/summary?classSubjectId=${cs.id}&semester=sem1`);
      assert.deepEqual(first.quarters, QUARTERS(93, 90));
      assert.equal(first.percentage, 92);
    });
  });

  describe('every figure built on the grade', () => {
    it('gives the general average of the year, or of the semester asked for', async () => {
      // s1 has csA (year 80; 1st Semester 60, 2nd Semester 100) and csA2 (year 90, 1st Semester only).
      const average = async (params = '') =>
        rowOf(
          await get(`/api/v1/grades/summary?classId=${school.classA.id}&groupBy=student${params}`),
          school.s1,
        );
      const year = await average();
      assert.equal(year.method, 'average');
      assert.equal(year.percentage, 85);
      assert.equal((await average('&semester=sem1')).percentage, 75); // (60 + 90) / 2
      const second = await average('&semester=sem2');
      assert.equal(second.percentage, 100, 'csA2 has no 2nd Semester row, so it is left out');
    });

    it("uses the year grade on the student's dashboard", async () => {
      const dashboard = await get('/api/v1/dashboard', school.s1);
      const byLesson = Object.fromEntries(
        dashboard.gradeSummary.map((row) => [row.classSubjectId, row.percentage]),
      );
      assert.equal(byLesson[school.csA.id], 80);
      assert.equal(byLesson[csA2.id], 90);
    });

    it('flags a student on the year grade in the at-risk list, not on the mean of the quarters', async () => {
      const { students } = (await get('/api/v1/dashboard', school.admin)).atRisk;
      // s2: csA's semesters 100 and 40 make 70, below the line, although its four quarters average 85; with
      // csA2's 70 the general average is 70 (on the quarters it would be 77.5 and pass).
      const s2 = students.find((student) => student.studentId === school.s2.studentId);
      assert.deepEqual([s2.reasons, s2.gradeAverage], [['grades'], 70]);
      // s1: 80 and 90 make a general average of 85; the old quarter rule gave 70 for csA and flagged them.
      assert.equal(
        students.some((student) => student.studentId === school.s1.studentId),
        false,
      );
    });
  });

  describe('a student who changed class', () => {
    let lessons;
    let moved; // the student
    const yearStart = academicYearStart(currentAcademicYear());

    before(async () => {
      moved = school.s3;
      lessons = {
        first: await assignTeacher(school.admin, {
          classId: (await makeClass(school.admin)).id,
          subjectId: school.csB.subjectId,
          teacherId: school.other.teacherId,
        }),
      };
      const classB = await makeClass(school.admin);
      lessons.second = await assignTeacher(school.admin, {
        classId: classB.id,
        subjectId: school.csB.subjectId,
        teacherId: school.other.teacherId,
      });
      // 40 days in the 1st Semester in the first class, then in the second.
      const moveOn = addDaysYmd(yearStart, 40);
      await run(
        `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on)
         VALUES (?, ?, 'transferred', ?, ?), (?, ?, 'active', ?, NULL)`,
        [moved.studentId, lessons.first.classId, yearStart, moveOn, moved.studentId, classB.id, moveOn],
      );
      const exam = (classSubject, title, semester, term, daysIn, score) =>
        newAssessment(
          classSubject.id,
          { title, semester, term, assessedOn: addDaysYmd(yearStart, daysIn) },
          school.admin,
        ).then((assessment) => gradeSheet(assessment, [[moved, score]], school.admin));
      // First class: 1st Semester Q1 60, Q2 80. Second class: 1st Semester Q2 100 (graded in both), Q3 75;
      // 2nd Semester Q1 70.
      await exam(lessons.first, 'A1', 'sem1', 'term1', 10, 60);
      await exam(lessons.first, 'A2', 'sem1', 'term2', 20, 80);
      await exam(lessons.second, 'B2', 'sem1', 'term2', 45, 100);
      await exam(lessons.second, 'B3', 'sem1', 'term3', 50, 75);
      await exam(lessons.second, 'B4', 'sem2', 'term1', 200, 70);
    });

    it('puts the quarters of both classes together per semester and quarter', async () => {
      const rows = await get(`/api/v1/grades/summary?studentId=${moved.studentId}`, school.admin);
      const byClass = Object.fromEntries(rows.map((row) => [row.classSubjectId, row]));
      assert.equal(byClass[lessons.first.id].percentage, 70); // the first class alone: (60 + 80) / 2
      assert.deepEqual(byClass[lessons.second.id].semesters, { sem1: 87.5, sem2: 70 });
      assert.equal(byClass[lessons.second.id].percentage, 78.75);
      // The subject once: 1st Semester Q1 60, Q2 (80 + 100) / 2 = 90, Q3 75 -> 75; 2nd Semester 70; year
      // 72.5. The mean of the two classes' grades, 74.38, counts the first class's two quarters as much as
      // the second's three.
      const [student] = await get(
        `/api/v1/grades/summary?groupBy=student&studentId=${moved.studentId}`,
        school.admin,
      );
      assert.equal(student.method, 'average');
      assert.equal(student.percentage, 72.5);
      const [first] = await get(
        `/api/v1/grades/summary?groupBy=student&studentId=${moved.studentId}&semester=sem1`,
        school.admin,
      );
      assert.equal(first.percentage, 75);
      const [second] = await get(
        `/api/v1/grades/summary?groupBy=student&studentId=${moved.studentId}&semester=sem2`,
        school.admin,
      );
      assert.equal(second.percentage, 70);
    });

    it('is judged on the year grade by the at-risk list', async () => {
      const { students } = (await get('/api/v1/dashboard', school.admin)).atRisk;
      const entry = students.find((student) => student.studentId === moved.studentId);
      assert.deepEqual([entry.reasons, entry.gradeAverage], [['grades'], 72.5]);
    });
  });
});
