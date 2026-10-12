import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query, run } from '../src/config/db.js';
import { academicYearStart, addDaysYmd, currentAcademicYear } from '../src/utils/dates.js';
import {
  api,
  as,
  assignTeacher,
  closeWorld,
  fillClass,
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
  let sectionCount = 0;

  /** Last year's class with every past subject, its class-subjects in `subjects`. */
  async function lastYearClass(name, gradeLevel) {
    const klass = await makeClass(admin, { name, gradeLevel, academicYear: lastYear });
    klass.subjects = [];
    for (const subject of pastSubjects) {
      klass.subjects.push(
        await assignTeacher(admin, {
          classId: klass.id,
          subjectId: subject.id,
          teacherId: teacher.teacherId,
        }),
      );
    }
    return klass;
  }

  /**
   * A section of its own for each student: a blank score counts 0 once an assessment has been given, so a
   * classmate's exams would count against the student.
   */
  const ownSection = (gradeLevel = 4) =>
    lastYearClass(`Grade ${gradeLevel} - S${(sectionCount += 1)}`, gradeLevel);

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
    pastSubjects = [];
    for (let i = 0; i < 4; i += 1) pastSubjects.push(await makeSubject(admin));
    grade4 = await lastYearClass('Grade 4 - A', 4);
    grade12 = await lastYearClass('Grade 12 - A', 12);
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
    const section = await ownSection();
    const student = await studentWith(section, section.subjects, [9, 6, 7, 8]);
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

  it('judges each subject on the average of its quarterly grades', async () => {
    // Subjects 2 to 4 pass with 9/10. Subject 1 has a 1st Quarter exam of 95/100 and a 2nd Quarter quiz of
    // 2/10: (95 + 20) / 2 = 57.5 fails, although the year's points (97 / 110 = 88.18) would pass.
    const section = await ownSection();
    const student = await studentWith(section, section.subjects, [null, 9, 9, 9]);
    for (const [term, type, maxScore, score, day] of [
      ['term1', 'exam', 100, 95, 30],
      ['term2', 'quiz', 10, 2, 120],
    ]) {
      const assessment = await api
        .post('/api/v1/assessments')
        .set(as(teacher))
        .send({
          classSubjectId: section.subjects[0].id,
          title: `${term} ${type} ${student.studentId}`,
          type,
          term,
          maxScore,
          assessedOn: addDaysYmd(lastYearStart, day),
        });
      assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
      const saved = await api
        .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
        .set(as(teacher))
        .send({ grades: [{ studentId: student.studentId, score }] });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }
    const result = await standing(student);
    assert.equal(result.status, 'remedial');
    assert.deepEqual(
      result.failedSubjects.map((subject) => [subject.subjectName, subject.percentage]),
      [[pastSubjects[0].name, 57.5]],
    );
    assert.equal(result.generalAverage, 81.88); // (57.5 + 90 + 90 + 90) / 4 = 81.875
  });

  it('judges each subject on the average of its semester grades, not of all its quarters', async () => {
    // Subjects 2 to 4 pass with 9/10. Subject 1: the 1st Quarter to the 3rd Quarter of the 1st Semester each
    // 10/10 (semester grade 100) and the 1st Quarter of the 2nd Semester 4/10 (semester grade 40). The year
    // is (100 + 40) / 2 = 70 and fails; the average of the four quarters, 85, would have passed.
    const section = await ownSection();
    const student = await studentWith(section, section.subjects, [null, 9, 9, 9]);
    for (const [semester, term, score, day] of [
      ['sem1', 'term1', 10, 20],
      ['sem1', 'term2', 10, 50],
      ['sem1', 'term3', 10, 80],
      ['sem2', 'term1', 4, 200],
    ]) {
      const assessment = await api
        .post('/api/v1/assessments')
        .set(as(teacher))
        .send({
          classSubjectId: section.subjects[0].id,
          title: `${semester} ${term} ${student.studentId}`,
          type: 'exam',
          semester,
          term,
          maxScore: 10,
          assessedOn: addDaysYmd(lastYearStart, day),
        });
      assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
      const saved = await api
        .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
        .set(as(teacher))
        .send({ grades: [{ studentId: student.studentId, score }] });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }
    const result = await standing(student);
    assert.equal(result.status, 'remedial');
    assert.deepEqual(
      result.failedSubjects.map((subject) => [subject.subjectName, subject.percentage]),
      [[pastSubjects[0].name, 70]],
    );
    assert.equal(result.generalAverage, 85); // (70 + 90 + 90 + 90) / 4
  });

  it('keeps a student who failed three or more subjects in the same grade level', async () => {
    const section = await ownSection();
    const student = await studentWith(section, section.subjects, [6, 5, 7, 9]);
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
    const section = await ownSection();
    const ungraded = await studentWith(section, section.subjects, [null, null, null, null]);
    const result = await standing(ungraded);
    assert.equal(result.status, 'needs_placement');
    assert.equal(result.lastClass.id, section.id);
    const res = await enrollIn(fresh, sections.g5a.id);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.standing, 'needs_placement');
  });

  it('counts only graded subjects and finishes a student who passed the highest grade level', async () => {
    const section = await ownSection();
    const partly = await studentWith(section, section.subjects, [8, null, null, 9]);
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

  it('offers a promoted student only a section with a seat left', async () => {
    const [{ enrolled }] = await query(
      "SELECT COUNT(*) AS enrolled FROM enrollments WHERE class_id = ? AND status = 'active'",
      [sections.g5a.id],
    );
    await fillClass(sections.g5a.id, 35 - enrolled);
    const section = await ownSection();
    const student = await studentWith(section, section.subjects, [9, 9, 9, 9]);
    const offered = await standing(student);
    assert.equal(offered.status, 'promoted');
    const seatsOf = (name) => offered.classes.find((klass) => klass.name === name);
    assert.deepEqual([seatsOf('Grade 5 - A').enrolled, seatsOf('Grade 5 - A').seats], [35, 35]);
    assert.ok(seatsOf('Grade 5 - B').enrolled < 35, 'Grade 5 - B still has seats, so no extra ones open');
    assert.equal(seatsOf('Grade 5 - B').seats, 35);

    const full = await enrollIn(student, sections.g5a.id);
    assert.equal(full.status, 409, JSON.stringify(full.body));
    assert.deepEqual(
      [full.body.error.details.reason, full.body.error.details.enrolled, full.body.error.details.seats],
      ['class_full', 35, 35],
    );
    assert.equal((await enrollIn(student, sections.g5b.id)).status, 201);
  });
});
