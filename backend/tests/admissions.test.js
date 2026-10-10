import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { bearer } from './helpers/fakeFirebase.js';
import { APPLICATION_FIELDS, api, as, buildSchool, closeWorld, resetWorld } from './helpers/harness.js';

after(closeWorld);

describe('admissions', () => {
  let school;
  let sequence = 0;

  /** Self-registers an applicant; returns the account with a ready Authorization header. */
  const apply = async (overrides = {}) => {
    sequence += 1;
    const res = await api.post('/api/v1/auth/register').send({
      email: `applicant${sequence}@school.test`,
      password: 'Password123!',
      firstName: 'Applicant',
      lastName: `Number${sequence}`,
      ...APPLICATION_FIELDS,
      ...overrides,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return { ...res.body.data, auth: bearer(res.body.data.firebaseUid) };
  };
  const studentIds = async (params) => {
    const res = await api.get(`/api/v1/students?${params}&limit=100`).set(as(school.admin));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.map((student) => student.id);
  };
  const getStudent = async (id) => (await api.get(`/api/v1/students/${id}`).set(as(school.admin))).body.data;
  const updateChecklist = (studentId, body, who = school.admin) =>
    api.patch(`/api/v1/admissions/${studentId}`).set(as(who)).send(body);
  const decline = (studentId, body, who = school.admin) =>
    api.post(`/api/v1/admissions/${studentId}/decline`).set(as(who)).send(body);
  const enroll = (studentId) =>
    api.post('/api/v1/enrollments').set(as(school.admin)).send({ studentId, classId: school.classB.id });
  const latestActivity = async (action) =>
    (await api.get('/api/v1/activity').set(as(school.admin))).body.data.find(
      (entry) => entry.action === action,
    );
  const unenrolledCount = async () =>
    (await api.get('/api/v1/dashboard').set(as(school.admin))).body.data.counts.unenrolledStudents;
  const notificationsOf = async (who) => (await api.get('/api/v1/notifications').set(as(who))).body.data;

  before(async () => {
    await resetWorld();
    school = await buildSchool();
  });

  it('registration sends a pending application with the grade and the previous school', async () => {
    const applicant = await apply({ gradeLevel: 11, previousSchool: '  Bagong Silang High School  ' });
    const { admission } = applicant.profile;
    assert.deepEqual(
      { ...admission, appliedAt: undefined },
      {
        status: 'pending',
        gradeLevel: 11,
        previousSchool: 'Bagong Silang High School',
        birthCertificateReceived: false,
        reportCardReceived: false,
        declineReason: null,
        appliedAt: undefined,
      },
    );
    assert.ok(admission.appliedAt);
    assert.equal(applicant.profile.guardianName, APPLICATION_FIELDS.guardianName);
    assert.deepEqual((await getStudent(applicant.studentId)).admission, admission);
  });

  it('refuses a registration without the grade or the guardian, and gives admin-created students none', async () => {
    for (const field of Object.keys(APPLICATION_FIELDS)) {
      const { [field]: _left, ...rest } = APPLICATION_FIELDS;
      const res = await api.post('/api/v1/auth/register').send({
        email: `missing.${field}@school.test`,
        password: 'Password123!',
        firstName: 'Missing',
        lastName: 'Field',
        ...rest,
      });
      assert.equal(res.status, 400, `without ${field}`);
    }
    const tooHigh = await api.post('/api/v1/auth/register').send({
      email: 'grade13@school.test',
      password: 'Password123!',
      firstName: 'Grade',
      lastName: 'Thirteen',
      ...APPLICATION_FIELDS,
      gradeLevel: 13,
    });
    assert.equal(tooHigh.status, 400);

    // An admin needs neither the guardian nor a grade, and the student has no application.
    const created = await api.post('/api/v1/users').set(as(school.admin)).send({
      role: 'student',
      email: 'admin.made@school.test',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'Made',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.profile.admission, null);
    assert.equal((await getStudent(school.s3.studentId)).admission, null);
  });

  it('lists applications by status and leaves applicants out of the students without a class', async () => {
    const before = await unenrolledCount();
    const applicant = await apply();
    assert.ok((await studentIds('admissionStatus=pending')).includes(applicant.studentId));
    assert.ok(!(await studentIds('admissionStatus=declined')).includes(applicant.studentId));

    const withoutAClass = await studentIds('hasActiveEnrollment=false&isActive=true');
    assert.ok(!withoutAClass.includes(applicant.studentId), 'the Admissions page owns pending applicants');
    assert.ok(withoutAClass.includes(school.s3.studentId), 'an admin-created student without a class stays');
    assert.equal(await unenrolledCount(), before, 'the dashboard counts the same way');
  });

  it('ticks documents off the checklist and logs it', async () => {
    const applicant = await apply();
    const res = await updateChecklist(applicant.studentId, { birthCertificateReceived: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.admission.birthCertificateReceived, true);
    assert.equal(res.body.data.admission.reportCardReceived, false);

    const entry = await latestActivity('admission.update');
    assert.equal(entry.entityId, applicant.studentId);
    assert.equal(entry.area, 'enrollments');
    assert.match(entry.summary, /birth certificate received/);

    assert.equal((await updateChecklist(applicant.studentId, {})).status, 400);
    assert.equal((await updateChecklist(applicant.studentId, { reportCardReceived: 'yes' })).status, 400);
    assert.equal((await updateChecklist(school.s3.studentId, { reportCardReceived: true })).status, 404);
  });

  it('declines with a reason the applicant reads, and resolves the admins sign-up note', async () => {
    const applicant = await apply();
    const link = `/admin/students/${applicant.studentId}`;
    const adminNote = async () => (await notificationsOf(school.admin)).find((note) => note.link === link);
    assert.equal((await adminNote()).isRead, false);

    assert.equal((await decline(applicant.studentId, {})).status, 400);
    assert.equal((await decline(applicant.studentId, { reason: '   ' })).status, 400);

    const reason = 'Grade 7 is full this school year. Please apply again in May.';
    const res = await decline(applicant.studentId, { reason });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.admission.status, 'declined');
    assert.equal(res.body.data.isActive, true, 'the account stays, so the applicant can read the reason');

    const me = await api.get('/api/v1/auth/me').set(as(applicant));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.profile.admission.status, 'declined');
    assert.equal(me.body.data.profile.admission.declineReason, reason);

    assert.equal((await adminNote()).isRead, true);
    const [told] = await notificationsOf(applicant);
    assert.deepEqual(
      [told.type, told.title, told.body],
      ['enrollment', 'Your application was declined', reason],
    );
    assert.match((await latestActivity('admission.decline')).summary, /Declined the Grade 7 application/);

    const again = await decline(applicant.studentId, { reason });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.details.reason, 'not_pending');
    assert.ok((await studentIds('admissionStatus=declined')).includes(applicant.studentId));
    assert.ok(!(await studentIds('hasActiveEnrollment=false')).includes(applicant.studentId));
  });

  it('enrolling admits the applicant, a declined one too, and an admitted one cannot be declined', async () => {
    const pending = await apply();
    const declined = await apply();
    await decline(declined.studentId, { reason: 'Missing documents.' });

    assert.equal((await enroll(pending.studentId)).status, 201);
    assert.equal((await getStudent(pending.studentId)).admission.status, 'admitted');

    const bulk = await api
      .post('/api/v1/enrollments/bulk')
      .set(as(school.admin))
      .send({ classId: school.classB.id, studentIds: [declined.studentId] });
    assert.equal(bulk.status, 201, JSON.stringify(bulk.body));
    const admitted = (await getStudent(declined.studentId)).admission;
    assert.equal(admitted.status, 'admitted');
    assert.equal(admitted.declineReason, null);

    const refused = await decline(pending.studentId, { reason: 'Too late.' });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.details.reason, 'not_pending');
  });

  it('answers 404 for a student without an application and 403 for teachers and students', async () => {
    assert.equal((await decline(school.s3.studentId, { reason: 'No.' })).status, 404);
    assert.equal((await decline(999999, { reason: 'No.' })).status, 404);

    const applicant = await apply();
    for (const who of [school.owner, applicant]) {
      assert.equal(
        (await updateChecklist(applicant.studentId, { reportCardReceived: true }, who)).status,
        403,
      );
      assert.equal((await decline(applicant.studentId, { reason: 'No.' }, who)).status, 403);
    }
  });

  it('deletes an applicant who was never placed in a class, not one who was', async () => {
    const remove = (account) => api.delete(`/api/v1/users/${account.id}`).set(as(school.admin));
    const unused = await apply();
    await updateChecklist(unused.studentId, { birthCertificateReceived: true });
    assert.equal((await remove(unused)).status, 200);

    const declined = await apply();
    await decline(declined.studentId, { reason: 'Duplicate account.' });
    assert.equal((await remove(declined)).status, 200);

    const placed = await apply();
    await enroll(placed.studentId);
    const refused = await remove(placed);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.details.reason, 'has_history');
  });
});
