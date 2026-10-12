import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { academicYearStart, addDaysYmd, currentAcademicYear } from '../src/utils/dates.js';
import {
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

/**
 * A blank score counts as 0 (the DepEd class record rule) once its assessment has been given, that is once
 * someone in the class-subject has a score for it, for every student who was in the class on its date. Before,
 * a result counted only the assessments a student had a score for, so missing an exam raised the grade.
 * An assessment nobody has a score for yet stays out, and so does one dated before a transferee joined.
 * Every figure built on the summary follows: the summary itself, a teacher's results per student, the student's
 * dashboard and the at-risk list.
 */
describe('blank scores', () => {
  let admin;
  let teacher;
  let classSubject;
  let present; // in the class all year; scores 18 on Quiz 1 and nothing on Quiz 2
  let classmate; // in the class all year; scores on both quizzes
  let transferee; // joins the class after Quiz 1
  let quiz3; // not given yet
  const day = (days) => addDaysYmd(academicYearStart(currentAcademicYear()), days);

  const get = async (path, who = admin) => {
    const res = await api.get(path).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const newQuiz = async (title, daysIn) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(teacher))
      .send({
        classSubjectId: classSubject.id,
        title,
        type: 'quiz',
        semester: 'sem1',
        term: 'term1',
        maxScore: 20,
        assessedOn: day(daysIn),
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const grade = async (assessment, scores) => {
    const res = await api
      .put(`/api/v1/assessments/${assessment.id}/grades`)
      .set(as(teacher))
      .send({ grades: scores.map(([student, score]) => ({ studentId: student.studentId, score })) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  };
  const resultsPerStudent = async () =>
    Object.fromEntries(
      (await get(`/api/v1/grades/summary?classSubjectId=${classSubject.id}&groupBy=student`)).map((row) => [
        row.studentId,
        row.percentage,
      ]),
    );

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    [present, classmate, transferee] = [
      await makeUser('student'),
      await makeUser('student'),
      await makeUser('student'),
    ];
    const klass = await makeClass(admin);
    classSubject = await assignTeacher(admin, {
      classId: klass.id,
      subjectId: (await makeSubject(admin)).id,
      teacherId: teacher.teacherId,
    });
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on) VALUES
         (?, ?, 'active', ?), (?, ?, 'active', ?), (?, ?, 'active', ?)`,
      [
        ...[present.studentId, klass.id, day(0)],
        ...[classmate.studentId, klass.id, day(0)],
        ...[transferee.studentId, klass.id, day(20)],
      ],
    );
    // Quiz 1 (day 10): present 18, classmate 15; the transferee was not in the class yet.
    // Quiz 2 (day 30): classmate 20, transferee 16; present has no score.
    // Quiz 3 (day 40): nobody has a score yet.
    const quiz1 = await newQuiz('Quiz 1', 10);
    const quiz2 = await newQuiz('Quiz 2', 30);
    quiz3 = await newQuiz('Quiz 3', 40);
    await grade(quiz1, [
      [present, 18],
      [classmate, 15],
    ]);
    await grade(quiz2, [
      [classmate, 20],
      [transferee, 16],
    ]);
  });

  it('counts a blank score of a given assessment as 0', async () => {
    // (18 + 0) / (20 + 20) = 45 %; counting only the quiz with a score gave 90 %.
    const [row] = await get(`/api/v1/grades/summary?studentId=${present.studentId}&semester=sem1`);
    assert.equal(row.percentage, 45);
    assert.deepEqual(row.quarters, { term1: 45, term2: null, term3: null, term4: null });
    assert.deepEqual([row.totalScore, row.totalMaxScore, row.assessmentsGraded], [18, 40, 1]);
    assert.equal((await get(`/api/v1/grades/summary?studentId=${present.studentId}`))[0].percentage, 45);
  });

  it('leaves out what was given before a transferee joined, and what nobody has a score for yet', async () => {
    const results = await resultsPerStudent();
    assert.equal(results[present.studentId], 45);
    assert.equal(results[classmate.studentId], 87.5); // (15 + 20) / 40
    assert.equal(results[transferee.studentId], 80, 'only Quiz 2: 16 / 20');
    // The class-subject's own row pools every counted score: (18 + 0 + 15 + 20 + 16) / 100.
    const [whole] = await get(`/api/v1/grades/summary?classSubjectId=${classSubject.id}`);
    assert.deepEqual([whole.totalScore, whole.totalMaxScore, whole.percentage], [69, 100, 69]);
  });

  it("shows the same result on the student's dashboard and in the at-risk list", async () => {
    const dashboard = await get('/api/v1/dashboard', present);
    assert.equal(dashboard.gradeSummary[0].percentage, 45);
    const { students } = (await get('/api/v1/dashboard')).atRisk;
    const flagged = students.find((student) => student.studentId === present.studentId);
    assert.deepEqual([flagged.reasons, flagged.gradeAverage], [['grades'], 45]);
    assert.equal(
      students.some((student) => student.studentId === transferee.studentId),
      false,
    );
  });

  it('starts counting an assessment once someone has a score for it', async () => {
    await grade(quiz3, [[classmate, 20]]);
    const results = await resultsPerStudent();
    assert.equal(results[present.studentId], 30); // 18 / 60
    assert.equal(results[transferee.studentId], 40); // 16 / 40
    assert.equal(results[classmate.studentId], 91.67); // 55 / 60
  });
});
