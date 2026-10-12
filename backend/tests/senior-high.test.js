import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { run } from '../src/config/db.js';
import { GRADING_GROUPS, SENIOR_HIGH_GRADING_GROUPS } from '../src/constants/shared.js';
import { academicYearStart, addDaysYmd, currentAcademicYear } from '../src/utils/dates.js';
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
import { openSession, waitForLockWaits } from './helpers/locks.js';

after(closeWorld);

const thisYear = currentAcademicYear();
const firstYear = Number(thisYear.slice(0, 4));
const lastYear = `${firstYear - 1}-${firstYear}`;
const nextYear = `${firstYear + 1}-${firstYear + 2}`;
const LOWER_GROUPS = GRADING_GROUPS.filter((group) => !SENIOR_HIGH_GRADING_GROUPS.includes(group));

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

/**
 * A subject in a Senior High group is taught in Grades 11-12 only and a subject in a Grades 1-10 group in
 * Grades 1-10 only, since the two stages weigh the components differently; a subject on points or its own
 * weights goes anywhere. Checked when a subject is assigned to a class and when a subject taught in a class of
 * this or a later school year changes group; a class's grade level is already fixed once it has a subject.
 */
describe('the grades a subject may be taught in', () => {
  let admin;
  let teacher;
  const assign = (klass, subject) =>
    api
      .post('/api/v1/class-subjects')
      .set(as(admin))
      .send({ classId: klass.id, subjectId: subject.id, teacherId: teacher.teacherId });
  const patchSubject = (subject, body) =>
    api.patch(`/api/v1/subjects/${subject.id}`).set(as(admin)).send(body);
  const getSubject = async (subject) =>
    (await api.get(`/api/v1/subjects/${subject.id}`).set(as(admin))).body.data;
  const subjectsOf = async (klass) =>
    (await api.get(`/api/v1/class-subjects?classId=${klass.id}`).set(as(admin))).body.data;
  const gradeClass = (gradeLevel, academicYear = thisYear) => makeClass(admin, { gradeLevel, academicYear });
  const assertMismatch = (res, message) => {
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.details.reason, 'grading_group_grade_mismatch');
    assert.match(res.body.error.message, message);
  };

  /** Sends `requests` while another session holds the writes of `statements` uncommitted, then commits them. */
  async function whileHeld(statements, requests) {
    const session = await openSession();
    try {
      await session.beginTransaction();
      for (const [sql, params] of statements) await session.query(sql, params);
      const pending = Promise.all(requests.map((send) => send()));
      await waitForLockWaits(requests.length);
      await session.commit();
      return await pending;
    } finally {
      await session.end();
    }
  }

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
  });

  it('refuses a Grades 1-10 subject in Grade 11 and 12, and takes it in Grades 1 to 10', async () => {
    const math = await makeSubject(admin, { name: 'Mathematics', gradingGroup: 'math_science' });
    const grade11 = await gradeClass(11);
    const res = await assign(grade11, math);
    assertMismatch(
      res,
      /^Mathematics uses Grades 1-10 weights and cannot be taught in Grade 11; use a Senior High subject$/,
    );
    assert.deepEqual(res.body.error.details, {
      reason: 'grading_group_grade_mismatch',
      gradingGroup: 'math_science',
      gradeLevel: 11,
    });
    assert.deepEqual(await subjectsOf(grade11), [], 'nothing was assigned');

    for (const group of LOWER_GROUPS) {
      const subject = await makeSubject(admin, { gradingGroup: group });
      for (const gradeLevel of [11, 12]) {
        assertMismatch(await assign(await gradeClass(gradeLevel), subject), /Grades 1-10 weights/);
      }
      for (const gradeLevel of [1, 10]) {
        const ok = await assign(await gradeClass(gradeLevel), subject);
        assert.equal(ok.status, 201, `${group} in Grade ${gradeLevel}: ${JSON.stringify(ok.body)}`);
      }
    }
  });

  it('refuses a Senior High subject in Grades 1 to 10, and takes it in Grade 11 and 12', async () => {
    const research = await makeSubject(admin, {
      name: 'Practical Research 1',
      gradingGroup: 'shs_immersion',
    });
    assertMismatch(
      await assign(await gradeClass(10), research),
      /^Practical Research 1 uses Senior High weights and cannot be taught in Grade 10; use a Grades 1-10 subject$/,
    );
    for (const group of SENIOR_HIGH_GRADING_GROUPS) {
      const subject = await makeSubject(admin, { gradingGroup: group });
      for (const gradeLevel of [1, 10]) {
        assertMismatch(await assign(await gradeClass(gradeLevel), subject), /Senior High weights/);
      }
      for (const gradeLevel of [11, 12]) {
        const ok = await assign(await gradeClass(gradeLevel), subject);
        assert.equal(ok.status, 201, `${group} in Grade ${gradeLevel}: ${JSON.stringify(ok.body)}`);
      }
    }
  });

  it('takes a subject on points or on its own weights in any grade', async () => {
    const onPoints = await makeSubject(admin);
    const weighted = await makeSubject(admin, { gradeWeights: { quiz: 40, exam: 60 } });
    for (const subject of [onPoints, weighted]) {
      for (const gradeLevel of [1, 10, 11, 12]) {
        const ok = await assign(await gradeClass(gradeLevel), subject);
        assert.equal(ok.status, 201, JSON.stringify(ok.body));
      }
    }
  });

  it('checks the class and the subject before the teacher, and answers 400 for a class that does not exist', async () => {
    const subject = await makeSubject(admin, { gradingGroup: 'shs_core' });
    const missing = await api
      .post('/api/v1/class-subjects')
      .set(as(admin))
      .send({ classId: 999999, subjectId: subject.id, teacherId: teacher.teacherId });
    assert.equal(missing.status, 400);
    assert.deepEqual(
      [missing.body.error.details.reason, missing.body.error.details.field],
      ['invalid_reference', 'classId'],
    );
    const retired = await makeSubject(admin, { gradingGroup: 'shs_core' });
    await patchSubject(retired, { isActive: false });
    const res = await assign(await gradeClass(7), retired);
    assert.equal(res.status, 400, 'a retired subject is refused as before, whatever its group');
    assert.equal(res.body.error.details.reason, 'subject_inactive');
  });

  it('refuses a group that does not fit a class of this school year that takes the subject', async () => {
    const math = await makeSubject(admin, { name: 'General Mathematics' });
    const grade11 = await gradeClass(11);
    assert.equal((await assign(grade11, math)).status, 201);

    const res = await patchSubject(math, { gradingGroup: 'math_science' });
    assertMismatch(
      res,
      new RegExp(
        `^General Mathematics is taught in ${grade11.name} \\(Grade 11, ${thisYear}\\), so it cannot use ` +
          'Grades 1-10 weights; choose a Senior High group$',
      ),
    );
    assert.deepEqual(res.body.error.details.classes, [
      { id: grade11.id, name: grade11.name, gradeLevel: 11, academicYear: thisYear },
    ]);
    assert.equal((await getSubject(math)).gradingGroup, null, 'nothing was written');

    // A Senior High group fits, and so does another one; points and weights fit any grade.
    for (const body of [
      { gradingGroup: 'shs_core' },
      { gradingGroup: 'shs_tvl' },
      { gradeWeights: { exam: 100 } },
      { gradingGroup: null, gradeWeights: null },
    ]) {
      const ok = await patchSubject(math, body);
      assert.equal(ok.status, 200, `${JSON.stringify(body)}: ${JSON.stringify(ok.body)}`);
    }
  });

  it('refuses a Senior High group for a subject taught in Grade 10, and counts later school years too', async () => {
    const english = await makeSubject(admin, { name: 'English' });
    const grade10 = await gradeClass(10, nextYear);
    const another = await gradeClass(9, nextYear);
    await assign(grade10, english);
    await assign(another, english);
    const res = await patchSubject(english, { gradingGroup: 'shs_core' });
    assertMismatch(
      res,
      /^English is taught in .+ \(Grade 9, .+\) and 1 other class, so it cannot use Senior High weights; choose a Grades 1-10 group$/,
    );
    assert.deepEqual(
      res.body.error.details.classes.map((klass) => [klass.gradeLevel, klass.academicYear]),
      [
        [9, nextYear],
        [10, nextYear],
      ],
    );
    assert.equal((await patchSubject(english, { gradingGroup: 'languages' })).status, 200);
  });

  it('refuses every group for a subject taught in both stages, which stays on points or weights', async () => {
    const pe = await makeSubject(admin, { name: 'Physical Education' });
    await assign(await gradeClass(10), pe);
    await assign(await gradeClass(11), pe);
    for (const gradingGroup of GRADING_GROUPS) {
      assertMismatch(
        await patchSubject(pe, { gradingGroup }),
        /taught in both Grades 1-10 and Senior High, so keep it on points or its own weights/,
      );
    }
    assert.equal((await patchSubject(pe, { gradeWeights: { project: 70, exam: 30 } })).status, 200);
  });

  it('leaves classes of earlier school years to the method lock', async () => {
    // Taught in last year's Grade 11 without grades: no result there to get wrong, so the group may change.
    const ungraded = await makeSubject(admin);
    await assign(await gradeClass(11, lastYear), ungraded);
    assert.equal((await patchSubject(ungraded, { gradingGroup: 'languages' })).status, 200);

    // With grades last year, the method is locked whatever the grade levels.
    const graded = await makeSubject(admin);
    const lastYearClass = await gradeClass(11, lastYear);
    const classSubject = (await assign(lastYearClass, graded)).body.data;
    const student = await makeUser('student');
    await run(
      `INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES (?, ?, 'completed', ?, ?)`,
      [
        student.studentId,
        lastYearClass.id,
        academicYearStart(lastYear),
        addDaysYmd(academicYearStart(thisYear), -1),
      ],
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
        assessedOn: addDaysYmd(academicYearStart(lastYear), 30),
      });
    assert.equal(assessment.status, 201, JSON.stringify(assessment.body));
    const saved = await api
      .put(`/api/v1/assessments/${assessment.body.data.id}/grades`)
      .set(as(teacher))
      .send({ grades: [{ studentId: student.studentId, score: 8 }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    // Taught in Grade 11 this year as well: the lock is the answer, for a fitting group or not.
    await assign(await gradeClass(11), graded);
    for (const gradingGroup of ['shs_core', 'languages']) {
      const locked = await patchSubject(graded, { gradingGroup });
      assert.equal(locked.status, 409);
      assert.equal(locked.body.error.details.reason, 'grading_method_locked', gradingGroup);
    }
  });

  it('lets a subject placed before this rule keep its group and still be edited', async () => {
    // A Grades 1-10 subject in a Grade 11 class, as an older version allowed (written here directly).
    const legacy = await makeSubject(admin, { name: 'Science' });
    await assign(await gradeClass(11), legacy);
    await run("UPDATE subjects SET grading_group = 'math_science' WHERE id = ?", [legacy.id]);
    const res = await patchSubject(legacy, { name: 'Earth Science', gradingGroup: 'math_science' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.name, 'Earth Science');
    // A different Grades 1-10 group is a change, and is refused.
    assertMismatch(await patchSubject(legacy, { gradingGroup: 'languages' }), /choose a Senior High group/);
  });

  it("fixes a class's grade level once it has a subject, so a Senior High class keeps its Senior High subjects", async () => {
    const core = await makeSubject(admin, { gradingGroup: 'shs_core' });
    const grade11 = await gradeClass(11);
    await assign(grade11, core);
    const res = await api.patch(`/api/v1/classes/${grade11.id}`).set(as(admin)).send({ gradeLevel: 10 });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'class_in_use');

    // An empty class may change grade, and what is assigned afterwards is checked against the new grade.
    const empty = await gradeClass(11);
    const moved = await api.patch(`/api/v1/classes/${empty.id}`).set(as(admin)).send({ gradeLevel: 10 });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assertMismatch(await assign(empty, core), /cannot be taught in Grade 10/);
  });

  it('waits for a group change in progress before assigning the subject, then checks the new group', async () => {
    const subject = await makeSubject(admin, { name: 'Statistics' });
    const grade11 = await gradeClass(11);
    const [res] = await whileHeld(
      // The group change's own transaction: written, not yet committed.
      [["UPDATE subjects SET grading_group = 'math_science' WHERE id = ?", [subject.id]]],
      [() => assign(grade11, subject)],
    );
    assertMismatch(res, /Statistics uses Grades 1-10 weights and cannot be taught in Grade 11/);
    assert.deepEqual(await subjectsOf(grade11), []);
  });

  it('waits for a grade level change in progress before assigning a subject, then checks the new grade', async () => {
    const subject = await makeSubject(admin, { gradingGroup: 'shs_academic' });
    const klass = await gradeClass(11);
    const [res] = await whileHeld(
      [['UPDATE classes SET grade_level = 10 WHERE id = ?', [klass.id]]],
      [() => assign(klass, subject)],
    );
    assertMismatch(res, /cannot be taught in Grade 10/);
  });

  it('waits for an assignment in progress before changing the group, then counts its class', async () => {
    const subject = await makeSubject(admin, { name: 'Contemporary Arts' });
    const grade12 = await gradeClass(12);
    const [res] = await whileHeld(
      [
        [
          'INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?)',
          [grade12.id, subject.id, teacher.teacherId],
        ],
      ],
      [() => patchSubject(subject, { gradingGroup: 'mapeh' })],
    );
    assertMismatch(
      res,
      /Contemporary Arts is taught in .+ \(Grade 12, .+\), so it cannot use Grades 1-10 weights/,
    );
    assert.equal((await getSubject(subject)).gradingGroup, null);
  });
});
