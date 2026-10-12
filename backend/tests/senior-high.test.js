import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { SENIOR_HIGH_GRADING_GROUPS } from '../src/constants/shared.js';
import {
  api,
  as,
  assignTeacher,
  closeWorld,
  enrollStudent,
  makeClass,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

/**
 * Senior High grading (DepEd Order 8 s. 2015, Table 5): the four Senior High groups through the API, from the
 * subject to the grade summary.
 */
describe('a Senior High subject', () => {
  let admin;
  let teacher;
  let student;

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    student = await makeUser('student');
  });

  it('can be in each Senior High group', async () => {
    for (const group of SENIOR_HIGH_GRADING_GROUPS) {
      const subject = await makeSubject(admin, { gradingGroup: group });
      assert.equal(subject.gradingGroup, group);
      assert.equal(subject.gradeWeights, null);
    }
    const subject = await makeSubject(admin, { gradingGroup: 'shs_academic' });
    const res = await api
      .patch(`/api/v1/subjects/${subject.id}`)
      .set(as(admin))
      .send({ gradingGroup: 'shs_immersion' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.gradingGroup, 'shs_immersion');
  });

  it('is graded by its group: a core subject with 70, 80 and 60 gets 72.5, transmuted 82', async () => {
    const subject = await makeSubject(admin, { name: 'Oral Communication', gradingGroup: 'shs_core' });
    const klass = await makeClass(admin, { name: 'Grade 11 - STEM', gradeLevel: 11 });
    const classSubject = await assignTeacher(admin, {
      classId: klass.id,
      subjectId: subject.id,
      teacherId: teacher.teacherId,
    });
    await enrollStudent(admin, { studentId: student.studentId, classId: klass.id });
    // Written work: a quiz 14/20 (70). Performance task: a project 40/50 (80). Quarterly assessment: the exam
    // 30/50 (60).
    for (const [type, maxScore, score] of [
      ['quiz', 20, 14],
      ['project', 50, 40],
      ['exam', 50, 30],
    ]) {
      const assessment = await api
        .post('/api/v1/assessments')
        .set(as(teacher))
        .send({ classSubjectId: classSubject.id, title: `The ${type}`, type, term: 'term1', maxScore });
      assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
      const saved = await api
        .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
        .set(as(teacher))
        .send({ grades: [{ studentId: student.studentId, score }] });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }

    const res = await api.get(`/api/v1/grades/summary?classSubjectId=${classSubject.id}`).set(as(student));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [row] = res.body.data;
    assert.equal(row.method, 'k12');
    assert.equal(row.gradingGroup, 'shs_core');
    // 70 * .25 + 80 * .50 + 60 * .25 = 72.5; 75 + floor(12.5 / 1.6) = 82.
    assert.equal(row.initialGrade, 72.5);
    assert.equal(row.percentage, 82);
    assert.deepEqual(
      row.components.map((part) => [part.component, part.weight, part.percentage]),
      [
        ['written', 25, 70],
        ['performance', 50, 80],
        ['quarterly', 25, 60],
      ],
    );
  });
});
