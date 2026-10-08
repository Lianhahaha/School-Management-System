import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query } from '../src/config/db.js';
import { averageOf, percentOf, subjectResult, sumPoints } from '../src/utils/grading.js';
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

describe('grade arithmetic (utils/grading.js)', () => {
  const totals = [
    { type: 'quiz', totalScore: 18, totalMaxScore: 20 }, // 90 %
    { type: 'exam', totalScore: 40, totalMaxScore: 80 }, // 50 %
  ];

  it('scores on points without weights', () => {
    assert.deepEqual(subjectResult(totals, null), {
      percentage: 58,
      initialGrade: 58,
      method: 'points',
      components: null,
    });
    assert.equal(percentOf(1, 3), 33.33);
    assert.equal(percentOf(5, 0), null);
    assert.equal(sumPoints([0.1, 0.2]), 0.3);
  });

  it('weights each type and leaves ungraded or zero-weighted types out', () => {
    assert.deepEqual(subjectResult(totals, { quiz: 50, exam: 50 }), {
      percentage: 70,
      initialGrade: 70,
      method: 'weighted',
      components: null,
    });
    // test (30) has no grades: quiz and exam share the remaining 70 in their 20 : 50 ratio
    assert.equal(subjectResult(totals, { quiz: 20, test: 30, exam: 50 }).percentage, 61.43);
    // only a zero-weighted type is graded: no result yet
    assert.equal(subjectResult([totals[0]], { exam: 100 }).percentage, null);
  });

  it('averages subject results, ignoring subjects without one', () => {
    assert.equal(averageOf([90, 50, null]), 70);
    assert.equal(averageOf([null]), null);
  });
});

describe('subject grade weights', () => {
  let school;
  let subject; // the subject of csA
  let quiz;
  let exam;
  const patchSubject = (who, body) => api.patch(`/api/v1/subjects/${subject.id}`).set(as(who)).send(body);
  const summary = async (who, params = '') => {
    const res = await api.get(`/api/v1/grades/summary${params}`).set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const newAssessment = async (body) => {
    const res = await api
      .post('/api/v1/assessments')
      .set(as(school.owner))
      .send({ classSubjectId: school.csA.id, term: 'term1', ...body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  const grade = (assessment, studentId, score) =>
    api
      .put(`/api/v1/assessments/${assessment.id}/grades`)
      .set(as(school.owner))
      .send({ grades: [{ studentId, score }] });

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    subject = (await api.get(`/api/v1/subjects/${school.csA.subjectId}`).set(as(school.admin))).body.data;
    quiz = await newAssessment({ title: 'Quiz 1', type: 'quiz', maxScore: 20 });
    exam = await newAssessment({ title: 'Exam 1', type: 'exam', maxScore: 80 });
    await grade(quiz, school.s1.studentId, 18);
    await grade(exam, school.s1.studentId, 40);
  });

  it('starts on points', async () => {
    assert.equal(subject.gradeWeights, null);
    const [row] = await summary(school.s1);
    assert.equal(row.percentage, 58);
    assert.equal(row.method, 'points');
    assert.equal(row.gradeWeights, null);
  });

  it('lets only admins set weights, which must be whole percents adding up to 100', async () => {
    assert.equal((await patchSubject(school.owner, { gradeWeights: { quiz: 50, exam: 50 } })).status, 403);
    const short = await patchSubject(school.admin, { gradeWeights: { quiz: 50, exam: 40 } });
    assert.equal(short.status, 400);
    assert.equal(
      (await patchSubject(school.admin, { gradeWeights: { quiz: 50.5, exam: 49.5 } })).status,
      400,
    );
    assert.equal((await patchSubject(school.admin, { gradeWeights: { essay: 100 } })).status, 400);

    const res = await patchSubject(school.admin, { gradeWeights: { quiz: 50, exam: 50 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.gradeWeights, {
      quiz: 50,
      test: 0,
      exam: 50,
      assignment: 0,
      project: 0,
      other: 0,
    });
    const stored = await query(
      'SELECT assessment_type, weight FROM subject_grade_weights WHERE subject_id = ?',
      [subject.id],
    );
    assert.equal(stored.length, 2, 'types weighted 0 are not stored');
  });

  it('weights the subject result per assessment type, everywhere it is shown', async () => {
    const [row] = await summary(school.s1);
    assert.equal(row.percentage, 70); // (90 * 50 + 50 * 50) / 100, points would say 58
    assert.equal(row.method, 'weighted');
    assert.equal(row.gradeWeights.quiz, 50);
    assert.equal(row.totalScore, 58, 'the points stay the plain sums');
    assert.equal(row.totalMaxScore, 100);

    const [byStudent] = await summary(school.owner, `?classSubjectId=${school.csA.id}&groupBy=student`);
    assert.equal(byStudent.percentage, 70);
    assert.equal(byStudent.method, 'weighted');

    const dashboard = (await api.get('/api/v1/dashboard').set(as(school.s1))).body.data;
    assert.equal(dashboard.gradeSummary[0].percentage, 70);
  });

  it('averages a student over several subjects (each subject counts once)', async () => {
    const second = await assignTeacher(school.admin, {
      classId: school.classA.id,
      subjectId: (await makeSubject(school.admin)).id,
      teacherId: school.owner.teacherId,
    });
    const test = (
      await api
        .post('/api/v1/assessments')
        .set(as(school.owner))
        .send({ classSubjectId: second.id, title: 'Test 1', type: 'test', term: 'term1', maxScore: 10 })
    ).body.data;
    await grade(test, school.s1.studentId, 10);

    const rows = await summary(school.owner, `?classId=${school.classA.id}&groupBy=student`);
    const s1 = rows.find((row) => row.studentId === school.s1.studentId);
    assert.equal(s1.method, 'average');
    assert.equal(s1.percentage, 85); // (70 + 100) / 2
  });

  it('grades a subject by K-12 components once it has a grading group', async () => {
    // Weights and a group together are refused; a group replaces the weights.
    const both = await patchSubject(school.admin, {
      gradingGroup: 'math_science',
      gradeWeights: { exam: 100 },
    });
    assert.equal(both.status, 400);
    assert.equal((await patchSubject(school.admin, { gradingGroup: 'arts' })).status, 400);
    const res = await patchSubject(school.admin, { gradingGroup: 'math_science' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.gradingGroup, 'math_science');
    assert.equal(res.body.data.gradeWeights, null);

    // Quiz 18/20 (written 90 %), exam 40/80 (quarterly 50 %), no performance task yet:
    // (90 * 40 + 50 * 20) / 60 = 76.67, transmuted to 85.
    const [row] = await summary(school.s1, `?classSubjectId=${school.csA.id}`);
    assert.equal(row.method, 'k12');
    assert.equal(row.initialGrade, 76.67);
    assert.equal(row.percentage, 85);
    assert.equal(row.gradingGroup, 'math_science');
    assert.deepEqual(
      row.components.map((part) => [part.component, part.percentage]),
      [
        ['written', 90],
        ['performance', null],
        ['quarterly', 50],
      ],
    );

    // Setting custom weights again takes the subject off K-12.
    const back = await patchSubject(school.admin, { gradeWeights: { quiz: 50, exam: 50 } });
    assert.equal(back.body.data.gradingGroup, null);
    assert.equal((await summary(school.s1, `?classSubjectId=${school.csA.id}`))[0].method, 'weighted');
  });

  it('goes back to points with null, and a subject with weights can still be deleted while unused', async () => {
    const res = await patchSubject(school.admin, { gradeWeights: null });
    assert.equal(res.body.data.gradeWeights, null);
    assert.equal((await summary(school.s1, `?classSubjectId=${school.csA.id}`))[0].percentage, 58);

    const spare = (
      await api
        .post('/api/v1/subjects')
        .set(as(school.admin))
        .send({ code: 'SPARE', name: 'Spare', gradeWeights: { exam: 100 } })
    ).body.data;
    assert.equal(spare.gradeWeights.exam, 100);
    assert.equal((await api.delete(`/api/v1/subjects/${spare.id}`).set(as(school.admin))).status, 200);
    assert.equal(
      (await query('SELECT * FROM subject_grade_weights WHERE subject_id = ?', [spare.id])).length,
      0,
    );

    // In use: 409, and the weights survive the failed delete.
    await patchSubject(school.admin, { gradeWeights: { exam: 100 } });
    const inUse = await api.delete(`/api/v1/subjects/${subject.id}`).set(as(school.admin));
    assert.equal(inUse.status, 409);
    const kept = (await api.get(`/api/v1/subjects/${subject.id}`).set(as(school.admin))).body.data;
    assert.equal(kept.gradeWeights.exam, 100);
  });
});
