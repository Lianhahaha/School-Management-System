import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
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

describe('subjects', () => {
  let admin;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
  });

  it('creates a subject, upper-cases the code and rejects a duplicate with 409', async () => {
    const res = await api.post('/api/v1/subjects').set(as(admin)).send({ code: 'phy', name: 'Physics' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.code, 'PHY');
    assert.equal(res.body.data.isActive, true);
    const dup = await api.post('/api/v1/subjects').set(as(admin)).send({ code: 'PHY', name: 'Other' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.details.key, 'subjects.uq_subjects_code');
  });

  it('is readable by every role but writable by admins only', async () => {
    const student = await makeUser('student');
    const teacher = await makeUser('teacher');
    assert.equal((await api.get('/api/v1/subjects').set(as(student))).status, 200);
    const denied = await api.post('/api/v1/subjects').set(as(teacher)).send({ code: 'ART', name: 'Art' });
    assert.equal(denied.status, 403);
  });

  it('blocks deleting a used subject with 409 in_use, and lets an admin retire it instead', async () => {
    const teacher = await makeUser('teacher');
    const subject = await makeSubject(admin);
    const klass = await makeClass(admin);
    await assignTeacher(admin, { classId: klass.id, subjectId: subject.id, teacherId: teacher.teacherId });
    const del = await api.delete(`/api/v1/subjects/${subject.id}`).set(as(admin));
    assert.equal(del.status, 409);
    assert.equal(del.body.error.details.reason, 'in_use');
    const retire = await api.patch(`/api/v1/subjects/${subject.id}`).set(as(admin)).send({ isActive: false });
    assert.equal(retire.body.data.isActive, false);
    const other = await makeClass(admin);
    const blocked = await api
      .post('/api/v1/class-subjects')
      .set(as(admin))
      .send({ classId: other.id, subjectId: subject.id, teacherId: teacher.teacherId });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.error.details.reason, 'subject_inactive');
  });

  it('deletes an unused subject and answers 404 for an unknown id', async () => {
    const subject = await makeSubject(admin);
    assert.equal((await api.delete(`/api/v1/subjects/${subject.id}`).set(as(admin))).status, 200);
    assert.equal((await api.get(`/api/v1/subjects/${subject.id}`).set(as(admin))).status, 404);
  });
});

describe('classes and teacher assignment', () => {
  let admin;
  let teacher;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
  });

  it('validates the academic year format and consecutiveness', async () => {
    for (const academicYear of ['2026/2027', '2026-2028', '26-27']) {
      const res = await api
        .post('/api/v1/classes')
        .set(as(admin))
        .send({ name: 'Grade 1 - A', gradeLevel: 1, academicYear });
      assert.equal(res.status, 400, academicYear);
    }
  });

  it('creates a class with a homeroom teacher and rejects a duplicate name in the same year', async () => {
    const created = await makeClass(admin, { name: 'Grade 9 - A', homeroomTeacherId: teacher.teacherId });
    assert.equal(created.homeroomTeacher.id, teacher.teacherId);
    assert.equal(created.studentCount, 0);
    const dup = await api
      .post('/api/v1/classes')
      .set(as(admin))
      .send({ name: 'Grade 9 - A', gradeLevel: 9, academicYear: '2026-2027' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.details.key, 'classes.uq_classes_year_name');
  });

  it('assigns a teacher once per class and subject, and can reassign', async () => {
    const klass = await makeClass(admin);
    const subject = await makeSubject(admin);
    const other = await makeUser('teacher');
    const assignment = await assignTeacher(admin, {
      classId: klass.id,
      subjectId: subject.id,
      teacherId: teacher.teacherId,
    });
    const dup = await api
      .post('/api/v1/class-subjects')
      .set(as(admin))
      .send({ classId: klass.id, subjectId: subject.id, teacherId: other.teacherId });
    assert.equal(dup.status, 409);
    const moved = await api
      .patch(`/api/v1/class-subjects/${assignment.id}`)
      .set(as(admin))
      .send({ teacherId: other.teacherId });
    assert.equal(moved.body.data.teacher.id, other.teacherId);
  });

  it('refuses to assign a deactivated teacher', async () => {
    const gone = await makeUser('teacher');
    await api.patch(`/api/v1/users/${gone.id}/status`).set(as(admin)).send({ isActive: false });
    const klass = await makeClass(admin);
    const subject = await makeSubject(admin);
    const res = await api
      .post('/api/v1/class-subjects')
      .set(as(admin))
      .send({ classId: klass.id, subjectId: subject.id, teacherId: gone.teacherId });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.reason, 'teacher_inactive');
  });

  it("refuses to deactivate a teacher who still has this year's assignments", async () => {
    const busy = await makeUser('teacher');
    await assignTeacher(admin, {
      classId: (await makeClass(admin, { academicYear: '2026-2027' })).id,
      subjectId: (await makeSubject(admin)).id,
      teacherId: busy.teacherId,
    });
    const res = await api.patch(`/api/v1/users/${busy.id}/status`).set(as(admin)).send({ isActive: false });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'teacher_has_assignments');
  });

  it('scopes class-subject lists: teachers see their own, students their class, foreign filters are 403', async () => {
    const mine = await makeUser('teacher');
    const theirs = await makeUser('teacher');
    const student = await makeUser('student');
    const classA = await makeClass(admin);
    const classB = await makeClass(admin);
    const subject = await makeSubject(admin);
    const subject2 = await makeSubject(admin);
    await assignTeacher(admin, { classId: classA.id, subjectId: subject.id, teacherId: mine.teacherId });
    await assignTeacher(admin, { classId: classB.id, subjectId: subject2.id, teacherId: theirs.teacherId });
    await enrollStudent(admin, { studentId: student.studentId, classId: classA.id });

    const teacherList = await api.get('/api/v1/class-subjects').set(as(mine));
    assert.deepEqual(
      teacherList.body.data.map((row) => row.classId),
      [classA.id],
    );
    const foreign = await api.get(`/api/v1/class-subjects?classId=${classB.id}`).set(as(mine));
    assert.equal(foreign.status, 403);
    assert.equal(foreign.body.error.details.reason, 'class_not_visible');

    // the student's active class changed after sign-in is read fresh on each request
    const studentList = await api.get('/api/v1/class-subjects').set(as(student));
    assert.deepEqual(
      studentList.body.data.map((row) => row.classId),
      [classA.id],
    );
    assert.equal((await api.get(`/api/v1/class-subjects?classId=${classB.id}`).set(as(student))).status, 403);
    assert.equal((await api.get('/api/v1/class-subjects?teacherId=me').set(as(mine))).body.meta.total, 1);
  });
});

describe('enrollments', () => {
  let admin;
  let classA;
  let classB;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    classA = await makeClass(admin);
    classB = await makeClass(admin);
  });

  it('enrolls a student once; a second active enrollment is a 409 already_enrolled', async () => {
    const student = await makeUser('student');
    const first = await enrollStudent(admin, { studentId: student.studentId, classId: classA.id });
    assert.equal(first.status, 'active');
    const again = await api
      .post('/api/v1/enrollments')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classB.id });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.details.reason, 'already_enrolled');
    assert.equal(again.body.error.details.activeEnrollmentId, first.id);
  });

  it('transfers in one step and re-opens the old row when the student returns', async () => {
    const student = await makeUser('student');
    const first = await enrollStudent(admin, { studentId: student.studentId, classId: classA.id });
    const moved = await api
      .post('/api/v1/enrollments/transfer')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classB.id });
    assert.equal(moved.status, 201);
    assert.equal(moved.body.data.classId, classB.id);
    const history = await api.get(`/api/v1/enrollments?studentId=${student.studentId}`).set(as(admin));
    assert.deepEqual(history.body.data.map((row) => row.status).sort(), ['active', 'transferred']);

    const back = await api
      .post('/api/v1/enrollments/transfer')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classA.id });
    assert.equal(back.body.data.id, first.id); // same row re-opened (UNIQUE student + class)
    assert.equal(back.body.data.status, 'active');
    const same = await api
      .post('/api/v1/enrollments/transfer')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classA.id });
    assert.equal(same.body.error.details.reason, 'same_class');
  });

  it('refuses to transfer a student who has no active enrollment', async () => {
    const student = await makeUser('student');
    const res = await api
      .post('/api/v1/enrollments/transfer')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classA.id });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.reason, 'no_active_enrollment');
  });

  it('bulk enrollment is all-or-nothing', async () => {
    const free = await makeUser('student');
    const busy = await makeUser('student');
    await enrollStudent(admin, { studentId: busy.studentId, classId: classB.id });
    const failed = await api
      .post('/api/v1/enrollments/bulk')
      .set(as(admin))
      .send({ classId: classA.id, studentIds: [free.studentId, busy.studentId] });
    assert.equal(failed.status, 409);
    assert.equal(failed.body.error.details.alreadyActive[0].studentId, busy.studentId);
    const stillFree = await api.get(`/api/v1/students/${free.studentId}`).set(as(admin));
    assert.equal(stillFree.body.data.currentEnrollment, null);

    const ok = await api
      .post('/api/v1/enrollments/bulk')
      .set(as(admin))
      .send({ classId: classA.id, studentIds: [free.studentId] });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.created, 1);
  });

  it('closes an enrollment as completed or withdrawn, once', async () => {
    const student = await makeUser('student');
    const enrollment = await enrollStudent(admin, { studentId: student.studentId, classId: classA.id });
    const done = await api
      .patch(`/api/v1/enrollments/${enrollment.id}`)
      .set(as(admin))
      .send({ status: 'completed' });
    assert.equal(done.body.data.status, 'completed');
    assert.ok(done.body.data.leftOn);
    const twice = await api
      .patch(`/api/v1/enrollments/${enrollment.id}`)
      .set(as(admin))
      .send({ status: 'withdrawn' });
    assert.equal(twice.status, 409);
    assert.equal(twice.body.error.details.reason, 'invalid_status_transition');
    const reactivate = await api
      .patch(`/api/v1/enrollments/${enrollment.id}`)
      .set(as(admin))
      .send({ status: 'active' });
    assert.equal(reactivate.status, 400);
  });

  it('deactivating a student withdraws their active enrollment', async () => {
    const student = await makeUser('student');
    await enrollStudent(admin, { studentId: student.studentId, classId: classA.id });
    await api.patch(`/api/v1/users/${student.id}/status`).set(as(admin)).send({ isActive: false });
    const row = await api.get(`/api/v1/students/${student.studentId}`).set(as(admin));
    assert.equal(row.body.data.currentEnrollment, null);
    const reenroll = await api
      .post('/api/v1/enrollments')
      .set(as(admin))
      .send({ studentId: student.studentId, classId: classA.id });
    assert.equal(reenroll.status, 400);
    assert.equal(reenroll.body.error.details.reason, 'student_not_enrollable');
  });

  it('students read only their own enrollments; a foreign studentId is 403', async () => {
    const mine = await makeUser('student');
    const other = await makeUser('student');
    await enrollStudent(admin, { studentId: mine.studentId, classId: classA.id });
    await enrollStudent(admin, { studentId: other.studentId, classId: classA.id });
    const own = await api.get('/api/v1/enrollments').set(as(mine));
    assert.equal(own.body.meta.total, 1);
    assert.equal(own.body.data[0].studentId, mine.studentId);
    const foreign = await api.get(`/api/v1/enrollments?studentId=${other.studentId}`).set(as(mine));
    assert.equal(foreign.status, 403);
    assert.equal((await api.post('/api/v1/enrollments').set(as(mine)).send({})).status, 403);
  });
});

describe('students, teachers and profiles', () => {
  let admin;
  let teacher;
  let classA;
  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    classA = await makeClass(admin);
    await assignTeacher(admin, {
      classId: classA.id,
      subjectId: (await makeSubject(admin)).id,
      teacherId: teacher.teacherId,
    });
  });

  it('teachers list only students of their visible classes; foreign classId is 403', async () => {
    const inClass = await makeUser('student');
    const outside = await makeUser('student');
    await enrollStudent(admin, { studentId: inClass.studentId, classId: classA.id });
    const res = await api.get('/api/v1/students').set(as(teacher));
    assert.deepEqual(
      res.body.data.map((row) => row.id),
      [inClass.studentId],
    );
    assert.equal((await api.get(`/api/v1/students/${outside.studentId}`).set(as(teacher))).status, 403);
    const classB = await makeClass(admin);
    assert.equal((await api.get(`/api/v1/students?classId=${classB.id}`).set(as(teacher))).status, 403);
  });

  it('students read themselves through `me` but not other students', async () => {
    const mine = await makeUser('student');
    const other = await makeUser('student');
    const me = await api.get('/api/v1/students/me').set(as(mine));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.id, mine.studentId);
    assert.equal((await api.get(`/api/v1/students/${other.studentId}`).set(as(mine))).status, 403);
    assert.equal((await api.get('/api/v1/students').set(as(mine))).status, 403);
    assert.equal((await api.get('/api/v1/students/me').set(as(teacher))).status, 400); // teacher has no student profile
  });

  it('an admin edits a student, including the unique student number', async () => {
    const a = await makeUser('student');
    const b = await makeUser('student');
    const res = await api
      .patch(`/api/v1/students/${a.studentId}`)
      .set(as(admin))
      .send({ firstName: 'Renamed', guardianName: 'Parent', gender: 'female' });
    assert.equal(res.body.data.firstName, 'Renamed');
    assert.equal(res.body.data.guardianName, 'Parent');
    const dup = await api
      .patch(`/api/v1/students/${a.studentId}`)
      .set(as(admin))
      .send({ studentNumber: b.profile.studentNumber });
    assert.equal(dup.status, 409);
    assert.equal((await api.patch(`/api/v1/students/${a.studentId}`).set(as(admin)).send({})).status, 400);
  });

  it('students and teachers update only their allowed contact fields through /auth/me', async () => {
    const student = await makeUser('student');
    const ok = await api
      .patch('/api/v1/auth/me')
      .set(as(student))
      .send({ phone: '+1 555 0100', address: '1 Main St' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.phone, '+1 555 0100');
    assert.equal(ok.body.data.profile.address, '1 Main St');
    const rejected = await api.patch('/api/v1/auth/me').set(as(teacher)).send({ address: 'x' });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.details.reason, 'student_only_fields');
    const phoneOnly = await api.patch('/api/v1/auth/me').set(as(teacher)).send({ phone: '+1 555 0111' });
    assert.equal(phoneOnly.body.data.phone, '+1 555 0111');
    assert.equal((await api.patch('/api/v1/auth/me').set(as(student)).send({ role: 'admin' })).status, 400);
  });

  it('teachers read their own profile (me) but not the staff list', async () => {
    const me = await api.get('/api/v1/teachers/me').set(as(teacher));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.id, teacher.teacherId);
    assert.equal((await api.get('/api/v1/teachers').set(as(teacher))).status, 403);
    assert.equal((await api.get('/api/v1/teachers').set(as(admin))).status, 200);
    const other = await makeUser('teacher');
    assert.equal((await api.get(`/api/v1/teachers/${other.teacherId}`).set(as(teacher))).status, 403);
  });

  it('searches and sorts students server-side with an accurate total', async () => {
    const res = await api
      .get('/api/v1/students?search=First&sortBy=studentNumber&sortOrder=desc&limit=2')
      .set(as(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.meta.total >= 2);
    assert.equal(res.body.meta.totalPages, Math.ceil(res.body.meta.total / 2));
    const numbers = res.body.data.map((row) => row.studentNumber);
    assert.deepEqual(numbers, [...numbers].sort().reverse());
    assert.equal((await api.get('/api/v1/students?sortBy=evil').set(as(admin))).status, 400);
    assert.equal((await api.get('/api/v1/students?unknown=1').set(as(admin))).status, 400);
  });
});
