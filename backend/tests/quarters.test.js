import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

/**
 * The four quarters through the API: each quarter of a subject is graded on its own and the final grade is
 * the average of the quarterly grades (DepEd Order 8 s. 2015), and every figure built on a subject's grade
 * (the summary, the student dashboard, a teacher's results per student, the at-risk list) uses that final
 * grade. The numbers are chosen so the old whole-year rule gives a different answer.
 */
describe('quarters and the final grade', () => {
  let school;
  let q4Quiz;
  const NO_QUARTERS = Object.freeze({ term1: null, term2: null, term3: null, term4: null });

  const newAssessment = async (body) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({ classSubjectId: school.csA.id, ...body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const grade = async (assessment, scores) => {
    const res = await api
      .put(`/api/v1/assessments/${assessment.id}/grades`)
      .set(as(school.owner))
      .send({ grades: scores.map(([student, score]) => ({ studentId: student.studentId, score })) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  };
  const summary = async (who, params = '') => {
    const res = await api.get(`/api/v1/grades/summary${params}`).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const resultOf = async (student) =>
    (await summary(school.owner, `?classSubjectId=${school.csA.id}&groupBy=student`)).find(
      (row) => row.studentId === student.studentId,
    ).percentage;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    // The subject of csA is on points. s1: Q1 exam 95/100, Q2 quiz 2/10. s2: Q1 exam 80/100, Q2 quiz 9/10.
    // Nothing is assessed in Q3; the Q4 quiz is not graded yet.
    const exam = await newAssessment({ title: 'Q1 exam', type: 'exam', term: 'term1', maxScore: 100 });
    const quiz = await newAssessment({ title: 'Q2 quiz', type: 'quiz', term: 'term2', maxScore: 10 });
    q4Quiz = await newAssessment({ title: 'Q4 quiz', type: 'quiz', term: 'term4', maxScore: 10 });
    await grade(exam, [
      [school.s1, 95],
      [school.s2, 80],
    ]);
    await grade(quiz, [
      [school.s1, 2],
      [school.s2, 9],
    ]);
  });

  it('takes assessments in the 4th Quarter and refuses any other term', async () => {
    assert.equal(q4Quiz.term, 'term4');
    const listed = await api
      .get(`/api/v1/assessments?classSubjectId=${school.csA.id}&term=term4`)
      .set(as(school.owner));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.deepEqual(
      listed.body.data.map((assessment) => assessment.title),
      ['Q4 quiz'],
    );
    const res = await api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({ classSubjectId: school.csA.id, title: 'Q5 quiz', type: 'quiz', term: 'term5', maxScore: 10 });
    assert.equal(res.status, 400);
  });

  it('averages the quarterly grades, leaving out the quarters with nothing graded', async () => {
    const [row] = await summary(school.s1);
    assert.equal(row.method, 'points');
    assert.deepEqual(row.quarters, { term1: 95, term2: 20, term3: null, term4: null });
    // (95 + 20) / 2. The old rule pooled the year's points: 97 / 110 = 88.18.
    assert.equal(row.percentage, 57.5);
    assert.equal(row.initialGrade, 57.5);
    assert.equal(row.totalScore, 97, 'the points stay the plain sums of the period');
    assert.equal(row.totalMaxScore, 110);
    assert.equal(row.assessmentsGraded, 2);
  });

  it('gives one quarter on its own with the term filter', async () => {
    const [row] = await summary(school.s1, '?term=term2');
    assert.deepEqual(row.quarters, { ...NO_QUARTERS, term2: 20 });
    assert.equal(row.percentage, 20);
    assert.equal(row.totalScore, 2);
    assert.deepEqual(await summary(school.s1, '?term=term3'), []);
  });

  it('uses the final grade on the dashboard, in the results per student and in the at-risk list', async () => {
    const dashboard = (await api.get('/api/v1/dashboard').set(as(school.s1))).body.data;
    assert.equal(dashboard.gradeSummary[0].percentage, 57.5);
    assert.equal(await resultOf(school.s1), 57.5);
    assert.equal(await resultOf(school.s2), 85); // (80 + 90) / 2; the year's points say 89 / 110 = 80.91

    // s1 passes on the year's points (88.18) but not on the average of the quarters.
    const atRisk = (await api.get('/api/v1/dashboard').set(as(school.admin))).body.data.atRisk;
    const s1 = atRisk.students.find((student) => student.studentId === school.s1.studentId);
    assert.deepEqual(s1.reasons, ['grades']);
    assert.equal(s1.gradeAverage, 57.5);
    assert.equal(
      atRisk.students.some((student) => student.studentId === school.s2.studentId),
      false,
    );
  });

  it('transmutes each K-12 quarter on its own and rounds the final grade to a whole number', async () => {
    const res = await api
      .patch(`/api/v1/subjects/${school.csA.subjectId}`)
      .set(as(school.admin))
      .send({ gradingGroup: 'math_science' });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    // s1, Math and Science: Q1 has only the exam (quarterly 95), initial 95, transmuted 96; Q2 only the quiz
    // (written 20), initial 20, transmuted 65. Final (96 + 65) / 2 = 80.5, a whole 81. The old rule weighed
    // the year's components together, (20 * 40 + 95 * 20) / 60 = 45, transmuted to 71: a fail.
    const [row] = await summary(school.s1);
    assert.equal(row.method, 'k12');
    assert.deepEqual(row.quarters, { term1: 96, term2: 65, term3: null, term4: null });
    assert.equal(row.percentage, 81);
    assert.equal(row.initialGrade, null, 'two quarters were transmuted, each on its own');
    assert.deepEqual(
      row.components.map((part) => [part.component, part.percentage]),
      [
        ['written', 20],
        ['performance', null],
        ['quarterly', 95],
      ],
    );

    const [q1] = await summary(school.s1, '?term=term1');
    assert.equal(q1.percentage, 96);
    assert.equal(q1.initialGrade, 95);

    // s2: Q1 exam 80 (transmuted 87), Q2 quiz 90 (transmuted 93): (87 + 93) / 2 = 90.
    assert.equal(await resultOf(school.s2), 90);
    const dashboard = (await api.get('/api/v1/dashboard').set(as(school.s1))).body.data;
    assert.equal(dashboard.gradeSummary[0].percentage, 81);
  });
});
