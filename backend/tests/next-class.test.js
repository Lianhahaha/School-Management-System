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
const lastYearStart = academicYearStart(lastYear);

describe('students enrolling themselves for next year (DepEd promotion)', () => {
  let admin;
  let teacher;
  let grade4;
  let grade12;
  let pastSubjects;
  let sections;

  /** A completed Grade `klass` year with one result per subject: scores out of 10, null = not graded. */
  async function studentWith(klass, classSubjects, scores) {
    const student = await makeUser('student');
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES (?, ?, 'completed', ?, ?)`,
      [student.studentId, klass.id, lastYearStart, addDaysYmd(academicYearStart(thisYear), -1)],
    );
    for (const [index, score] of scores.entries()) {
      if (score === null) continue;
      const assessment = await api
        .post('/api/v1/assessments')
        .set(as(teacher))
        .send({
          classSubjectId: classSubjects[index].id,
          title: `Exam ${student.studentId}`,
          type: 'exam',
          term: 'term1',
          maxScore: 10,
          assessedOn: addDaysYmd(lastYearStart, 30),
        });
      assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
      const saved = await api
        .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
        .set(as(teacher))
        .send({ grades: [{ studentId: student.studentId, score }] });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }
    return student;
  }

  const standing = async (who) => {
    const res = await api.get('/api/v1/enrollments/next-class').set(as(who));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  };
  const enrollIn = (who, classId) =>
    api.post('/api/v1/enrollments/next-class').set(as(who)).send({ classId });

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    const assignAll = async (klass) => {
      const assigned = [];
      for (const subject of pastSubjects) {
        assigned.push(
          await assignTeacher(admin, {
            classId: klass.id,
            subjectId: subject.id,
            teacherId: teacher.teacherId,
          }),
        );
      }
      return assigned;
    };
    pastSubjects = [];
    for (let i = 0; i < 4; i += 1) pastSubjects.push(await makeSubject(admin));
    grade4 = await makeClass(admin, { name: 'Grade 4 - A', gradeLevel: 4, academicYear: lastYear });
    grade4.subjects = await assignAll(grade4);
    grade12 = await makeClass(admin, { name: 'Grade 12 - A', gradeLevel: 12, academicYear: lastYear });
    grade12.subjects = await assignAll(grade12);
    sections = {
      g5a: await makeClass(admin, { name: 'Grade 5 - A', gradeLevel: 5, academicYear: thisYear }),
      g5b: await makeClass(admin, { name: 'Grade 5 - B', gradeLevel: 5, academicYear: thisYear }),
      g4c: await makeClass(admin, { name: 'Grade 4 - C', gradeLevel: 4, academicYear: thisYear }),
    };
  });

  it('moves a student who passed every subject up one grade level and lets them pick a section', async () => {
    const student = await studentWith(grade4, grade4.subjects, [9, 8, 7.5, 10]);
    const before = await standing(student);
    assert.equal(before.status, 'promoted');
    assert.deepEqual(before.lastClass, {
      id: grade4.id,
      name: 'Grade 4 - A',
      gradeLevel: 4,
      academicYear: lastYear,
    });
    assert.equal(before.generalAverage, 86.25);
    assert.deepEqual(before.failedSubjects, []);
    assert.equal(before.gradeLevel, 5);
    assert.equal(before.academicYear, thisYear);
    assert.deepEqual(
      before.classes.map((klass) => [klass.name, klass.studentCount]),
      [
        ['Grade 5 - A', 0],
        ['Grade 5 - B', 0],
      ],
    );

    const wrong = await enrollIn(student, sections.g4c.id);
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.details.reason, 'class_not_offered');

    const res = await enrollIn(student, sections.g5b.id);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.class.name, 'Grade 5 - B');
    assert.equal(res.body.data.status, 'active');

    const after = await standing(student);
    assert.equal(after.status, 'enrolled');
    assert.equal(after.lastClass.id, sections.g5b.id);
    const again = await enrollIn(student, sections.g5a.id);
    assert.equal(again.status, 409);
    assert.deepEqual(
      [again.body.error.details.reason, again.body.error.details.standing],
      ['not_eligible', 'enrolled'],
    );
  });

  it('sends a student who failed one or two subjects to remedial classes, without self-enrollment', async () => {
    const student = await studentWith(grade4, grade4.subjects, [9, 6, 7, 8]);
    const result = await standing(student);
    assert.equal(result.status, 'remedial');
    assert.deepEqual(
      result.failedSubjects.map((subject) => [subject.subjectName, subject.percentage]),
      [
        [pastSubjects[1].name, 60],
        [pastSubjects[2].name, 70],
      ],
    );
    assert.deepEqual([result.gradeLevel, result.academicYear, result.classes], [null, null, []]);
    const res = await enrollIn(student, sections.g5a.id);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.standing, 'remedial');
  });

  it('keeps a student who failed three or more subjects in the same grade level', async () => {
    const student = await studentWith(grade4, grade4.subjects, [6, 5, 7, 9]);
    const result = await standing(student);
    assert.equal(result.status, 'retained');
    assert.equal(result.failedSubjects.length, 3);
    assert.equal(result.gradeLevel, 4);
    assert.deepEqual(
      result.classes.map((klass) => klass.name),
      ['Grade 4 - C'],
    );
    assert.equal((await enrollIn(student, sections.g5a.id)).body.error.details.reason, 'class_not_offered');
    assert.equal((await enrollIn(student, sections.g4c.id)).status, 201);
  });

  it('leaves the placement to an admin when there is nothing to judge', async () => {
    const fresh = await makeUser('student');
    assert.equal((await standing(fresh)).status, 'needs_placement');
    const ungraded = await studentWith(grade4, grade4.subjects, [null, null, null, null]);
    const result = await standing(ungraded);
    assert.equal(result.status, 'needs_placement');
    assert.equal(result.lastClass.id, grade4.id);
    const res = await enrollIn(fresh, sections.g5a.id);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.standing, 'needs_placement');
  });

  it('counts only graded subjects and finishes a student who passed the highest grade level', async () => {
    const partly = await studentWith(grade4, grade4.subjects, [8, null, null, 9]);
    assert.equal((await standing(partly)).status, 'promoted');
    const graduate = await studentWith(grade12, grade12.subjects, [9, 9, 9, 9]);
    const result = await standing(graduate);
    assert.equal(result.status, 'finished');
    assert.deepEqual(result.classes, []);
  });

  it('is for students only', async () => {
    assert.equal((await api.get('/api/v1/enrollments/next-class').set(as(admin))).status, 403);
    assert.equal((await api.get('/api/v1/enrollments/next-class').set(as(teacher))).status, 403);
    assert.equal((await enrollIn(admin, sections.g5a.id)).status, 403);
    const student = await makeUser('student');
    const res = await api
      .post('/api/v1/enrollments/next-class')
      .set(as(student))
      .send({ classId: sections.g5a.id, studentId: 1 });
    assert.equal(res.status, 400, 'the student is always the caller');
  });
});
