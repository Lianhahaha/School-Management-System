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

const thisYear = currentAcademicYear();
const lastYear = `${Number(thisYear.slice(0, 4)) - 1}-${thisYear.slice(0, 4)}`;

/**
 * A subject's grading method (its K-12 group or its weights) is locked once it has grades from an earlier
 * school year: every result is computed from the method as it is now, so changing it would rewrite those
 * years' results, report cards, SF10s and promotion standings. While its grades are all of the current year,
 * or it has none, the method can still change.
 */
describe('the grading method of a subject with history', () => {
  let admin;
  let teacher;
  const patchSubject = (subject, body) =>
    api.patch(`/api/v1/subjects/${subject.id}`).set(as(admin)).send(body);
  const getSubject = async (subject) =>
    (await api.get(`/api/v1/subjects/${subject.id}`).set(as(admin))).body.data;

  /** A class of `academicYear` taking `subject`, one student in it all year, graded 8 / 10 once. */
  async function gradedIn(subject, academicYear) {
    const klass = await makeClass(admin, { academicYear });
    const classSubject = await assignTeacher(admin, {
      classId: klass.id,
      subjectId: subject.id,
      teacherId: teacher.teacherId,
    });
    const student = await makeUser('student');
    const start = academicYearStart(academicYear);
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES (?, ?, ?, ?, ?)`,
      academicYear === thisYear
        ? [student.studentId, klass.id, 'active', start, null]
        : [student.studentId, klass.id, 'completed', start, addDaysYmd(academicYearStart(thisYear), -1)],
    );
    const assessment = await api
      .post('/api/v1/assessments')
      .set(as(teacher))
      .send({
        classSubjectId: classSubject.id,
        title: 'Exam',
        type: 'exam',
        term: 'term1',
        maxScore: 10,
        assessedOn: addDaysYmd(start, 30),
      });
    assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
    const saved = await api
      .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
      .set(as(teacher))
      .send({ grades: [{ studentId: student.studentId, score: 8 }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  }

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
  });

  it('refuses a new group or new weights once the subject has grades from an earlier school year', async () => {
    const subject = await makeSubject(admin);
    await gradedIn(subject, lastYear);
    await gradedIn(subject, thisYear);
    for (const body of [
      { gradingGroup: 'math_science' },
      { gradeWeights: { quiz: 50, exam: 50 } },
      { gradingGroup: 'languages', gradeWeights: null },
    ]) {
      const res = await patchSubject(subject, body);
      assert.equal(res.status, 409, JSON.stringify(res.body));
      assert.equal(res.body.error.details.reason, 'grading_method_locked');
      assert.match(res.body.error.message, /earlier school year/);
    }
    const kept = await getSubject(subject);
    assert.deepEqual([kept.gradingGroup, kept.gradeWeights], [null, null], 'nothing was written');

    // Sending the method it already has is no change, and the rest of the subject stays editable.
    const same = await patchSubject(subject, { name: 'Renamed', gradingGroup: null, gradeWeights: null });
    assert.equal(same.status, 200, JSON.stringify(same.body));
    assert.equal(same.body.data.name, 'Renamed');
  });

  it('compares the stored weights, so the same weights sent again are no change', async () => {
    const subject = await makeSubject(admin, { gradeWeights: { quiz: 40, exam: 60 } });
    await gradedIn(subject, lastYear);
    const again = await patchSubject(subject, { gradeWeights: { quiz: 40, exam: 60, project: 0 } });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const changed = await patchSubject(subject, { gradeWeights: { quiz: 30, exam: 70 } });
    assert.equal(changed.status, 409);
    assert.equal((await getSubject(subject)).gradeWeights.quiz, 40);
  });

  it('still lets a subject change its method while its grades are all of this school year, or it has none', async () => {
    const current = await makeSubject(admin);
    await gradedIn(current, thisYear);
    const res = await patchSubject(current, { gradingGroup: 'math_science' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.gradingGroup, 'math_science');
    const back = await patchSubject(current, { gradeWeights: { exam: 100 } });
    assert.equal(back.status, 200, JSON.stringify(back.body));

    const unused = await makeSubject(admin);
    const fresh = await patchSubject(unused, { gradeWeights: { quiz: 100 } });
    assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  });
});
