import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query } from '../src/config/db.js';
import { addDaysYmd, currentAcademicYear, todayYmd } from '../src/utils/dates.js';
import {
  APPLICATION_FIELDS,
  api,
  as,
  buildSchool,
  closeWorld,
  lettersOf,
  makeAssistant,
  makeSubject,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

after(closeWorld);

const year = currentAcademicYear();
const today = todayYmd();

/**
 * The student assistant: the admin's everyday office work, without what cannot be undone, changes grades or
 * attendance, or manages accounts other than students'.
 */
describe('student assistant', () => {
  let school;
  let assistant;
  let sequence = 0;

  /** A request as the assistant, e.g. send('post', '/classes', body). */
  const send = (method, path, body) => {
    const request = api[method](`/api/v1${path}`).set(as(assistant));
    return body === undefined ? request : request.send(body);
  };
  const expectStatus = (res, status) => assert.equal(res.status, status, JSON.stringify(res.body));
  const expectForbidden = (res) => {
    expectStatus(res, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  };
  const newAccount = (role, overrides = {}) => {
    sequence += 1;
    return {
      email: `office${sequence}@school.test`,
      password: 'Password123!',
      role,
      firstName: 'Office',
      lastName: `Made${lettersOf(sequence)}`,
      ...overrides,
    };
  };

  before(async () => {
    await resetWorld();
    school = await buildSchool();
    assistant = await makeAssistant();
  });

  it('is an account without a profile, which only sign-up creates (never an admin)', async () => {
    const me = await send('get', '/auth/me');
    expectStatus(me, 200);
    assert.equal(me.body.data.role, 'assistant');
    assert.equal(me.body.data.profile, null);
    assert.equal(me.body.data.studentId, null);
    assert.equal(me.body.data.assistantRequest.status, 'approved');

    const body = newAccount('assistant');
    const created = await api.post('/api/v1/users').set(as(school.admin)).send(body);
    expectStatus(created, 400);
    assert.match(created.body.error.details.issues[0].message, /sign up themselves/);
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [body.email]);
    assert.equal(n, 0, 'no assistant account was created');

    // The role comes from accountType, never from a `role` field.
    const signUp = await api
      .post('/api/v1/auth/register')
      .send({ ...newAccount('assistant'), ...APPLICATION_FIELDS });
    expectStatus(signUp, 400);
  });

  it('creates student accounts only', async () => {
    const student = await send('post', '/users', newAccount('student', { profile: { gender: 'female' } }));
    expectStatus(student, 201);
    assert.equal(student.body.data.role, 'student');
    assert.equal(student.body.data.profile.gender, 'female');

    const assistantAccount = newAccount('assistant');
    expectStatus(await send('post', '/users', assistantAccount), 400);
    for (const role of ['teacher', 'admin']) {
      const body = newAccount(role, role === 'teacher' ? { profile: {} } : {});
      const res = await send('post', '/users', body);
      expectForbidden(res);
      assert.equal(res.body.error.details.reason, 'role_not_allowed');
      const [{ n }] = await query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [body.email]);
      assert.equal(n, 0, `no ${role} account was created`);
    }
  });

  it('edits student records and student accounts, and no other account', async () => {
    const profile = await send('patch', `/students/${school.s3.studentId}`, {
      lrn: '136512140009',
      guardianName: 'Rosa Dela Cruz',
    });
    expectStatus(profile, 200);
    assert.equal(profile.body.data.lrn, '136512140009');

    const account = await send('patch', `/users/${school.s3.id}`, { phone: '+63 917 000 1111' });
    expectStatus(account, 200);
    assert.equal(account.body.data.phone, '+63 917 000 1111');

    const otherAssistant = await makeAssistant();
    for (const target of [school.owner, school.admin, otherAssistant]) {
      expectForbidden(await send('patch', `/users/${target.id}`, { lastName: 'Changed' }));
    }
    const [{ lastName }] = await query('SELECT last_name FROM users WHERE id = ?', [school.admin.id]);
    assert.equal(lastName, school.admin.lastName, "the admin's account is unchanged");
    expectForbidden(await send('patch', `/teachers/${school.owner.teacherId}`, { department: 'Science' }));
  });

  it('reads the student and teacher directories, but not the account list', async () => {
    const students = await send('get', `/students?search=${encodeURIComponent(school.s1.lastName)}`);
    expectStatus(students, 200);
    assert.deepEqual(
      students.body.data.map((row) => row.id),
      [school.s1.studentId],
    );
    expectStatus(await send('get', `/students/${school.s3.studentId}`), 200);
    expectStatus(await send('get', '/teachers'), 200);
    expectStatus(await send('get', `/teachers/${school.other.teacherId}`), 200);
    expectForbidden(await send('get', '/users'));
    expectForbidden(await send('get', `/users/${school.s1.id}`));
  });

  it('never deletes, deactivates or reactivates an account', async () => {
    const [unused, inactive] = [await makeUser('student'), await makeUser('student')];
    const deactivated = await api
      .patch(`/api/v1/users/${inactive.id}/status`)
      .set(as(school.admin))
      .send({ isActive: false });
    expectStatus(deactivated, 200);

    expectForbidden(await send('delete', `/users/${unused.id}`));
    expectForbidden(await send('patch', `/users/${unused.id}/status`, { isActive: false }));
    expectForbidden(await send('patch', `/users/${inactive.id}/status`, { isActive: true }));
    expectForbidden(await send('patch', `/users/${school.admin.id}/status`, { isActive: false }));
    const isActive = async (user) =>
      (await query('SELECT is_active AS isActive FROM users WHERE id = ?', [user.id]))[0].isActive;
    assert.equal(await isActive(unused), true, 'still there and active');
    assert.equal(await isActive(inactive), false);
    assert.equal(await isActive(school.admin), true);
  });

  it('is told about a new application, ticks its documents off and places the student', async () => {
    const signUp = await api.post('/api/v1/auth/register').send({
      email: 'applicant@school.test',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'Applicant',
      ...APPLICATION_FIELDS,
    });
    expectStatus(signUp, 201);
    const { studentId } = signUp.body.data;
    const noteOf = async () =>
      (await send('get', '/notifications')).body.data.find(
        (note) => note.link === `/admin/students/${studentId}`,
      );
    const note = await noteOf();
    assert.equal(note.type, 'signup');
    assert.equal(note.title, 'New application: New Applicant');
    assert.equal(note.isRead, false);

    const checklist = await send('patch', `/admissions/${studentId}`, { birthCertificateReceived: true });
    expectStatus(checklist, 200);
    assert.equal(checklist.body.data.admission.birthCertificateReceived, true);
    expectStatus(await send('post', `/admissions/${studentId}/decline`, { reason: 'Full' }), 404);
    const placed = await send('post', '/enrollments', { studentId, classId: school.classB.id });
    expectStatus(placed, 201);
    assert.equal((await noteOf()).isRead, true, 'nothing is left to do');
  });

  it('enrolls, transfers and withdraws students, but does not end a school year', async () => {
    const [first, second] = [await makeUser('student'), await makeUser('student')];
    const enrolled = await send('post', '/enrollments', {
      studentId: first.studentId,
      classId: school.classA.id,
    });
    expectStatus(enrolled, 201);
    expectStatus(
      await send('post', '/enrollments/bulk', { classId: school.classA.id, studentIds: [second.studentId] }),
      201,
    );
    const moved = await send('post', '/enrollments/transfer', {
      studentId: first.studentId,
      classId: school.classB.id,
    });
    expectStatus(moved, 201);

    expectForbidden(
      await send('post', '/enrollments/complete', {
        classId: school.classA.id,
        studentIds: [second.studentId],
      }),
    );
    const [{ id: secondEnrollmentId }] = await query(
      "SELECT id FROM enrollments WHERE student_id = ? AND status = 'active'",
      [second.studentId],
    );
    const completed = await send('patch', `/enrollments/${secondEnrollmentId}`, { status: 'completed' });
    expectForbidden(completed);
    assert.equal(completed.body.error.details.reason, 'role_not_allowed');
    const withdrawn = await send('patch', `/enrollments/${secondEnrollmentId}`, { status: 'withdrawn' });
    expectStatus(withdrawn, 200);
    assert.equal(withdrawn.body.data.status, 'withdrawn');
  });

  it('sets up classes, teacher assignments and the timetable, but deletes no class or assignment', async () => {
    const created = await send('post', '/classes', {
      name: 'Grade 8 - Rizal',
      gradeLevel: 8,
      academicYear: year,
    });
    expectStatus(created, 201);
    const klass = created.body.data;
    const renamed = await send('patch', `/classes/${klass.id}`, { name: 'Grade 8 - Mabini' });
    expectStatus(renamed, 200);
    assert.equal(renamed.body.data.name, 'Grade 8 - Mabini');

    const subject = await makeSubject(school.admin);
    const assigned = await send('post', '/class-subjects', {
      classId: klass.id,
      subjectId: subject.id,
      teacherId: school.owner.teacherId,
    });
    expectStatus(assigned, 201);
    const classSubjectId = assigned.body.data.id;
    const reassigned = await send('patch', `/class-subjects/${classSubjectId}`, {
      teacherId: school.other.teacherId,
    });
    expectStatus(reassigned, 200);
    assert.equal(reassigned.body.data.teacherId, school.other.teacherId);

    const slot = await send('post', '/schedules', {
      classSubjectId,
      dayOfWeek: 2,
      startTime: '13:00',
      endTime: '14:00',
    });
    expectStatus(slot, 201);
    expectStatus(await send('patch', `/schedules/${slot.body.data.id}`, { room: 'Room 4' }), 200);
    expectStatus(await send('delete', `/schedules/${slot.body.data.id}`), 200);

    expectForbidden(await send('delete', `/class-subjects/${classSubjectId}`));
    expectForbidden(await send('delete', `/classes/${klass.id}`));
  });

  it('reads subjects but does not create or change them or their grading', async () => {
    const subject = await makeSubject(school.admin);
    expectStatus(await send('get', '/subjects'), 200);
    expectForbidden(await send('post', '/subjects', { code: 'OFFICE-1', name: 'Office subject' }));
    expectForbidden(await send('patch', `/subjects/${subject.id}`, { name: 'Renamed' }));
    expectForbidden(await send('patch', `/subjects/${subject.id}`, { gradeWeights: { quiz: 50, exam: 50 } }));
    expectForbidden(await send('patch', `/subjects/${subject.id}`, { gradingGroup: 'languages' }));
    expectForbidden(await send('delete', `/subjects/${subject.id}`));
  });

  it('publishes, edits and deletes announcements and calendar entries like an admin', async () => {
    const byAdmin = await api
      .post('/api/v1/announcements')
      .set(as(school.admin))
      .send({ title: 'Enrollment week', body: 'From Monday.', audience: 'all' });
    expectStatus(byAdmin, 201);
    const notice = await send('post', '/announcements', {
      title: 'Office hours',
      body: 'The office closes at 4 pm.',
      audience: 'students',
    });
    expectStatus(notice, 201);
    assert.equal(notice.body.data.classId, null, 'school-wide, as an admin may');
    assert.equal(notice.body.data.author.role, 'assistant');

    expectStatus(
      await send('patch', `/announcements/${byAdmin.body.data.id}`, { title: 'Enrollment week!' }),
      200,
    );
    const all = await send('get', '/announcements?status=all');
    expectStatus(all, 200);
    assert.ok(all.body.data.some((row) => row.id === byAdmin.body.data.id));
    expectStatus(await send('delete', `/announcements/${notice.body.data.id}`), 200);

    const event = await send('post', '/calendar-events', {
      title: 'Card day',
      type: 'event',
      startsOn: addDaysYmd(today, 20),
    });
    expectStatus(event, 201);
    expectStatus(
      await send('patch', `/calendar-events/${event.body.data.id}`, { title: 'Report card day' }),
      200,
    );
    expectStatus(await send('delete', `/calendar-events/${event.body.data.id}`), 200);
  });

  it('reads attendance and grades school-wide, but never marks attendance or grades', async () => {
    const marked = await api
      .put('/api/v1/attendance/sheet')
      .set(as(school.owner))
      .send({
        classSubjectId: school.csA.id,
        date: today,
        records: [{ studentId: school.s1.studentId, status: 'absent' }],
      });
    expectStatus(marked, 200);
    const quiz = await api.post('/api/v1/assessments').set(as(school.owner)).send({
      classSubjectId: school.csA.id,
      title: 'Quiz 1',
      type: 'quiz',
      term: 'term1',
      maxScore: 20,
    });
    expectStatus(quiz, 201);
    const quizId = quiz.body.data.id;
    const graded = await api
      .put(`/api/v1/assessments/${quizId}/grades`)
      .set(as(school.owner))
      .send({ grades: [{ studentId: school.s1.studentId, score: 15 }] });
    expectStatus(graded, 200);

    const records = await send('get', '/attendance');
    expectStatus(records, 200);
    assert.equal(records.body.meta.total, 1);
    const summary = await send('get', `/attendance/summary?classSubjectId=${school.csA.id}`);
    expectStatus(summary, 200);
    assert.equal(summary.body.data.absent, 1);
    const sheet = await send('get', `/attendance/sheet?classSubjectId=${school.csA.id}&date=${today}`);
    expectStatus(sheet, 200);
    assert.equal(sheet.body.data.records.length, 2);
    const grades = await send('get', `/grades/summary?classSubjectId=${school.csA.id}&groupBy=student`);
    expectStatus(grades, 200);
    assert.equal(grades.body.data.find((row) => row.studentId === school.s1.studentId).percentage, 75);
    const roster = await send('get', `/assessments/${quizId}/grades`);
    expectStatus(roster, 200);
    const gradeId = roster.body.data.records.find((row) => row.studentId === school.s1.studentId).gradeId;
    expectStatus(await send('get', '/grades'), 200);
    expectStatus(await send('get', `/assessments/${quizId}`), 200);

    expectForbidden(
      await send('put', '/attendance/sheet', {
        classSubjectId: school.csA.id,
        date: today,
        records: [{ studentId: school.s1.studentId, status: 'present' }],
      }),
    );
    expectForbidden(
      await send('post', '/assessments', {
        classSubjectId: school.csA.id,
        title: 'Office quiz',
        type: 'quiz',
        term: 'term1',
        maxScore: 10,
      }),
    );
    expectForbidden(await send('patch', `/assessments/${quizId}`, { maxScore: 30 }));
    expectForbidden(await send('delete', `/assessments/${quizId}`));
    expectForbidden(
      await send('put', `/assessments/${quizId}/grades`, {
        grades: [{ studentId: school.s1.studentId, score: 20 }],
      }),
    );
    expectForbidden(await send('delete', `/grades/${gradeId}`));
    const [{ status }] = await query('SELECT status FROM attendance WHERE student_id = ?', [
      school.s1.studentId,
    ]);
    assert.equal(status, 'absent', 'the mark is unchanged');
  });

  it('reads the activity log, which names the assistant as the one who acted', async () => {
    const log = await send('get', '/activity?area=calendar');
    expectStatus(log, 200);
    const recorded = log.body.data.find((entry) => entry.action === 'calendar.create');
    assert.deepEqual(recorded.actor, {
      id: assistant.id,
      name: `${assistant.firstName} ${assistant.lastName}`,
      role: 'assistant',
    });
  });

  it("gets the admin's dashboard", async () => {
    const [own, admins] = await Promise.all([
      send('get', '/dashboard'),
      api.get('/api/v1/dashboard').set(as(school.admin)),
    ]);
    expectStatus(own, 200);
    assert.equal(own.body.data.role, 'admin', 'the payload is the admin one');
    assert.deepEqual(Object.keys(own.body.data).sort(), Object.keys(admins.body.data).sort());
    assert.deepEqual(own.body.data.counts, admins.body.data.counts);
  });
});
