import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { query, run } from '../src/config/db.js';
import { currentAcademicYear, nextAcademicYear } from '../src/utils/dates.js';
import { bearer } from './helpers/fakeFirebase.js';
import {
  APPLICATION_FIELDS,
  PRIVACY_CONSENT,
  api,
  as,
  closeWorld,
  fillClass,
  lettersOf,
  makeAssistant,
  makeClass,
  makeUser,
  resetWorld,
} from './helpers/harness.js';
import { openSession, waitForLockWaits } from './helpers/locks.js';

after(closeWorld);

const thisYear = currentAcademicYear();

/**
 * Sign-up: new students pick their own section (no approval, within the seats), and student assistants sign up
 * and wait for the school office to approve them, with no access until then.
 */
describe('sign-up: students pick their class, student assistants wait for approval', () => {
  let admin;
  let teacher;
  let student;
  let sequence = 0;

  const expectStatus = (res, status) => assert.equal(res.status, status, JSON.stringify(res.body));
  const expectRefused = (res, status, reason) => {
    expectStatus(res, status);
    assert.equal(res.body.error.details.reason, reason, JSON.stringify(res.body));
  };
  const withAuth = (account) => ({ ...account, auth: bearer(account.firebaseUid) });
  const accountFields = () => {
    sequence += 1;
    return {
      email: `signup${sequence}@school.test`,
      password: 'Password123!',
      firstName: 'Sign',
      lastName: `Up${lettersOf(sequence)}`,
    };
  };
  const register = (body) => api.post('/api/v1/auth/register').send(body);
  /** A student who signed up for `gradeLevel`, with a ready Authorization header. */
  const signUpStudent = async (gradeLevel) => {
    const res = await register({ ...accountFields(), ...APPLICATION_FIELDS, gradeLevel });
    expectStatus(res, 201);
    return withAuth(res.body.data);
  };
  /** A student assistant who signed up (request pending), with a ready Authorization header. */
  const signUpAssistant = async (overrides = {}) => {
    const res = await register({
      accountType: 'assistant',
      ...accountFields(),
      ...PRIVACY_CONSENT,
      ...overrides,
    });
    expectStatus(res, 201);
    return withAuth(res.body.data);
  };
  const nextClass = async (who) => {
    const res = await api.get('/api/v1/enrollments/next-class').set(as(who));
    expectStatus(res, 200);
    return res.body.data;
  };
  const enrollIn = (who, classId) =>
    api.post('/api/v1/enrollments/next-class').set(as(who)).send({ classId });
  const me = async (who) => {
    const res = await api.get('/api/v1/auth/me').set(as(who));
    expectStatus(res, 200);
    return res.body.data;
  };
  const approve = (who, userId) => api.post(`/api/v1/assistant-requests/${userId}/approve`).set(as(who));
  const decline = (who, userId, body) =>
    api.post(`/api/v1/assistant-requests/${userId}/decline`).set(as(who)).send(body);
  const requests = async (who, params = '') => {
    const res = await api.get(`/api/v1/assistant-requests?limit=100${params}`).set(as(who));
    expectStatus(res, 200);
    return res.body.data;
  };
  const notesOf = async (who) => (await api.get('/api/v1/notifications?limit=100').set(as(who))).body.data;
  const activity = async (action) =>
    (await api.get('/api/v1/activity?limit=100').set(as(admin))).body.data.filter(
      (entry) => entry.action === action,
    );
  const section = (name, gradeLevel, academicYear = thisYear) =>
    makeClass(admin, { name, gradeLevel, academicYear });

  before(async () => {
    await resetWorld();
    admin = await makeUser('admin');
    teacher = await makeUser('teacher');
    student = await makeUser('student');
  });

  describe('new students', () => {
    it('picks a section of the grade applied for, this school year, and is admitted at once', async () => {
      const g7a = await section('Grade 7 - A', 7);
      const g7b = await section('Grade 7 - B', 7);
      const g7NextYear = await section('Grade 7 - A', 7, nextAcademicYear(thisYear));
      const g8 = await section('Grade 8 - Mabini', 8);
      const newcomer = await signUpStudent(7);

      const standing = await nextClass(newcomer);
      assert.equal(standing.status, 'new');
      assert.deepEqual([standing.gradeLevel, standing.academicYear, standing.lastClass], [7, thisYear, null]);
      assert.deepEqual(
        standing.classes.map((klass) => [klass.id, klass.enrolled, klass.seats]),
        [
          [g7a.id, 0, 35],
          [g7b.id, 0, 35],
        ],
      );

      for (const other of [g8, g7NextYear]) {
        expectRefused(await enrollIn(newcomer, other.id), 400, 'class_not_offered');
      }
      const res = await enrollIn(newcomer, g7b.id);
      expectStatus(res, 201);
      assert.equal(res.body.data.class.name, 'Grade 7 - B');

      const account = await me(newcomer);
      assert.equal(account.profile.admission.status, 'admitted');
      assert.equal(account.currentEnrollment.classId, g7b.id);
      assert.equal((await nextClass(newcomer)).status, 'enrolled');
      expectRefused(await enrollIn(newcomer, g7a.id), 409, 'not_eligible');

      const [entry] = await activity('enrollment.create');
      assert.equal(entry.actor.id, newcomer.id, 'the student enrolled themselves');
      const signUpNote = (await notesOf(admin)).find(
        (note) => note.link === `/admin/students/${newcomer.studentId}`,
      );
      assert.equal(signUpNote.isRead, true, 'nothing is left for the office to do');
    });

    it('offers no section to a student declined before students picked their class', async () => {
      const declined = await signUpStudent(7);
      await run("UPDATE admissions SET status = 'declined', decline_reason = 'Full.' WHERE student_id = ?", [
        declined.studentId,
      ]);
      const standing = await nextClass(declined);
      assert.deepEqual([standing.status, standing.classes], ['needs_placement', []]);
      const [g7] = (
        await query("SELECT id FROM classes WHERE name = 'Grade 7 - A' AND academic_year = ?", [thisYear])
      ).map((row) => row.id);
      expectRefused(await enrollIn(declined, g7), 409, 'not_eligible');
    });

    it('opens 10 more seats in every section once each one has 35 students', async () => {
      const g8a = await section('Grade 8 - A', 8);
      const g8b = await section('Grade 8 - B', 8);
      // Grade 8 - Mabini from the first test: every section of the grade must be full.
      const [mabini] = await query("SELECT id FROM classes WHERE name = 'Grade 8 - Mabini'");
      for (const klass of [g8a, g8b, mabini]) await fillClass(klass.id, 35);

      const newcomer = await signUpStudent(8);
      const { classes } = await nextClass(newcomer);
      assert.deepEqual(
        classes.map((klass) => [klass.enrolled, klass.seats]),
        [
          [35, 45],
          [35, 45],
          [35, 45],
        ],
      );
      expectStatus(await enrollIn(newcomer, g8a.id), 201);
    });

    it('refuses a full section while another has seats, but never limits the office', async () => {
      const g9a = await section('Grade 9 - A', 9);
      const g9b = await section('Grade 9 - B', 9);
      await fillClass(g9a.id, 34);
      await fillClass(g9b.id, 35);
      const newcomer = await signUpStudent(9);
      assert.deepEqual(
        (await nextClass(newcomer)).classes.map((klass) => [klass.name, klass.enrolled, klass.seats]),
        [
          ['Grade 9 - A', 34, 35],
          ['Grade 9 - B', 35, 35],
        ],
      );

      const placed = await makeUser('student');
      const byOffice = await api
        .post('/api/v1/enrollments')
        .set(as(admin))
        .send({ studentId: placed.studentId, classId: g9b.id });
      expectStatus(byOffice, 201);

      const full = await enrollIn(newcomer, g9b.id);
      expectRefused(full, 409, 'class_full');
      assert.deepEqual(
        [full.body.error.details.classId, full.body.error.details.enrolled, full.body.error.details.seats],
        [g9b.id, 36, 35],
      );
      assert.equal((await me(newcomer)).profile.admission.status, 'pending', 'nothing was written');
      expectStatus(await enrollIn(newcomer, g9a.id), 201);
    });

    it('gives the last seat to one of two students who pick it at the same moment', async () => {
      const g10 = await section('Grade 10 - A', 10);
      // A second section with seats left, so a full Grade 10 - A does not open the extra seats.
      await section('Grade 10 - B', 10);
      await fillClass(g10.id, 34);
      const [first, second] = [await signUpStudent(10), await signUpStudent(10)];

      const session = await openSession();
      let results;
      try {
        // Both requests queue up behind this lock on the section, then run one after the other.
        await session.query('START TRANSACTION');
        await session.query('SELECT id FROM classes WHERE id = ? FOR UPDATE', [g10.id]);
        const pending = Promise.all([enrollIn(first, g10.id), enrollIn(second, g10.id)]);
        await waitForLockWaits(2);
        await session.query('ROLLBACK');
        results = await pending;
      } finally {
        await session.end();
      }
      assert.deepEqual(
        results.map((res) => res.status).sort(),
        [201, 409],
        JSON.stringify(results.map((res) => res.body)),
      );
      assert.equal(results.find((res) => res.status === 409).body.error.details.reason, 'class_full');
      const [{ enrolled }] = await query(
        "SELECT COUNT(*) AS enrolled FROM enrollments WHERE class_id = ? AND status = 'active'",
        [g10.id],
      );
      assert.equal(enrolled, 35);
    });
  });

  describe('student assistants', () => {
    it('signs up with the account fields only, waits for approval and tells the office', async () => {
      const fields = { ...accountFields(), phone: '+63 917 222 3333' };
      const res = await register({ accountType: 'assistant', ...fields, ...PRIVACY_CONSENT });
      expectStatus(res, 201);
      const account = res.body.data;
      assert.deepEqual(
        [account.role, account.profile, account.studentId, account.phone],
        ['assistant', null, null, '+63 917 222 3333'],
      );
      assert.equal(account.assistantRequest.status, 'pending');
      assert.equal(account.assistantRequest.declineReason, null);
      assert.ok(account.assistantRequest.requestedAt);
      const [{ profiles }] = await query('SELECT COUNT(*) AS profiles FROM students WHERE user_id = ?', [
        account.id,
      ]);
      assert.equal(profiles, 0, 'no student profile');

      const note = (await notesOf(admin)).find(
        (row) => row.link === `/admin/assistant-requests?user=${account.id}`,
      );
      assert.deepEqual(
        [note.type, note.title, note.isRead],
        ['signup', `Student assistant request: ${fields.firstName} ${fields.lastName}`, false],
      );
      const [entry] = await activity('user.register');
      assert.match(entry.summary, /signed up as a student assistant/);

      // Each with the consent, so each is refused for its own field.
      const consenting = () => ({ ...accountFields(), ...PRIVACY_CONSENT });
      const refused = [
        { accountType: 'assistant', ...consenting(), gradeLevel: 7 },
        { accountType: 'assistant', ...consenting(), guardianName: 'Maria Cruz' },
        { accountType: 'assistant', ...consenting(), lrn: '136512140001' },
        { accountType: 'assistant', ...consenting(), role: 'admin' },
        { accountType: 'admin', ...consenting() },
        { accountType: 'teacher', ...consenting() },
      ];
      for (const body of refused) {
        expectStatus(await register(body), 400);
        const [{ n }] = await query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [body.email]);
        assert.equal(n, 0, `no account for ${JSON.stringify(body)}`);
      }
    });

    it('gives a pending assistant no access beyond their own account', async () => {
      const pending = await signUpAssistant();
      const other = await signUpAssistant();
      const account = await me(pending);
      assert.equal(account.assistantRequest.status, 'pending');
      const patched = await api.patch('/api/v1/auth/me').set(as(pending)).send({ phone: '+63 917 000 4444' });
      expectStatus(patched, 200);
      assert.equal(patched.body.data.phone, '+63 917 000 4444');

      const calls = [
        ['get', '/students'],
        ['get', '/dashboard'],
        ['get', '/notifications'],
        ['get', '/notifications/unread-count'],
        ['get', '/enrollments'],
        ['get', '/classes'],
        ['get', '/announcements'],
        ['get', '/activity'],
        ['get', '/assistant-requests'],
        ['post', `/assistant-requests/${other.id}/approve`],
        ['post', '/users', { role: 'student', ...accountFields() }],
      ];
      for (const [method, path, body] of calls) {
        const req = api[method](`/api/v1${path}`).set(as(pending));
        const res = await (body ? req.send(body) : req);
        expectRefused(res, 403, 'assistant_not_approved');
        assert.equal(res.body.error.code, 'FORBIDDEN');
      }

      // Not the office yet: a new student's sign-up is not announced to them.
      await signUpStudent(7);
      const [{ notes }] = await query('SELECT COUNT(*) AS notes FROM notifications WHERE user_id = ?', [
        pending.id,
      ]);
      assert.equal(notes, 0);
    });

    it('keeps teachers and students away from the requests', async () => {
      const pending = await signUpAssistant();
      for (const who of [teacher, student]) {
        expectRefused(await api.get('/api/v1/assistant-requests').set(as(who)), 403, 'role_not_allowed');
        expectRefused(await approve(who, pending.id), 403, 'role_not_allowed');
        expectRefused(await decline(who, pending.id, { reason: 'No.' }), 403, 'role_not_allowed');
      }
      assert.equal((await me(pending)).assistantRequest.status, 'pending');
    });

    it('is approved by an admin, and works in the office from then on', async () => {
      const applicant = await signUpAssistant({ phone: '+63 917 555 0000' });
      const listed = (await requests(admin, '&status=pending')).find((row) => row.userId === applicant.id);
      assert.deepEqual(
        { ...listed, requestedAt: undefined },
        {
          userId: applicant.id,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: '+63 917 555 0000',
          isActive: true,
          status: 'pending',
          declineReason: null,
          requestedAt: undefined,
          decidedAt: null,
          decidedBy: null,
        },
      );
      expectRefused(await api.get('/api/v1/students').set(as(applicant)), 403, 'assistant_not_approved');

      const res = await approve(admin, applicant.id);
      expectStatus(res, 200);
      assert.equal(res.body.data.status, 'approved');
      assert.deepEqual(res.body.data.decidedBy, {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
      });
      assert.ok(res.body.data.decidedAt);

      expectStatus(await api.get('/api/v1/students').set(as(applicant)), 200);
      assert.equal((await me(applicant)).assistantRequest.status, 'approved');
      assert.ok((await requests(admin, '&status=approved')).some((row) => row.userId === applicant.id));
      assert.ok(!(await requests(admin, '&status=pending')).some((row) => row.userId === applicant.id));

      expectRefused(await approve(admin, applicant.id), 409, 'not_pending');
      expectStatus(await approve(admin, 999999), 404);
      expectStatus(await approve(admin, admin.id), 404);

      const [told] = await notesOf(applicant);
      assert.deepEqual([told.type, told.title], ['signup', 'Your student assistant request was approved']);
      const officeNote = (await notesOf(admin)).find(
        (note) => note.link === `/admin/assistant-requests?user=${applicant.id}`,
      );
      assert.equal(officeNote.isRead, true, 'nothing is left to do');
      const entry = (await activity('assistant_request.approve')).find(
        (row) => row.entityId === applicant.id,
      );
      assert.equal(entry.area, 'accounts');
      assert.equal(entry.actor.id, admin.id);
    });

    it('is approved by an approved assistant too, never by a pending one', async () => {
      const approved = await makeAssistant();
      const [first, second] = [await signUpAssistant(), await signUpAssistant()];
      expectRefused(await approve(second, first.id), 403, 'assistant_not_approved');
      expectRefused(await approve(first, first.id), 403, 'assistant_not_approved');

      const res = await approve(approved, first.id);
      expectStatus(res, 200);
      assert.equal(res.body.data.decidedBy.id, approved.id);
      assert.equal((await me(second)).assistantRequest.status, 'pending');
    });

    it('is declined with a reason the applicant reads, and stays locked out', async () => {
      const applicant = await signUpAssistant();
      expectStatus(await decline(admin, applicant.id, {}), 400);
      expectStatus(await decline(admin, applicant.id, { reason: '   ' }), 400);
      expectStatus(await decline(admin, applicant.id, { reason: 'x'.repeat(256) }), 400);

      const reason = 'We have enough student assistants this semester.';
      const res = await decline(admin, applicant.id, { reason });
      expectStatus(res, 200);
      assert.deepEqual([res.body.data.status, res.body.data.declineReason], ['declined', reason]);

      const { assistantRequest } = await me(applicant);
      assert.deepEqual([assistantRequest.status, assistantRequest.declineReason], ['declined', reason]);
      const blocked = await api.get('/api/v1/students').set(as(applicant));
      expectRefused(blocked, 403, 'assistant_not_approved');
      assert.match(blocked.body.error.message, /declined/);

      expectRefused(await decline(admin, applicant.id, { reason }), 409, 'not_pending');
      expectRefused(await approve(admin, applicant.id), 409, 'not_pending');
      const entry = (await activity('assistant_request.decline')).find(
        (row) => row.entityId === applicant.id,
      );
      assert.deepEqual([entry.area, entry.details.reason], ['accounts', reason]);

      // The unused account can go, request and all.
      expectStatus(await api.delete(`/api/v1/users/${applicant.id}`).set(as(admin)), 200);
      const [{ remaining }] = await query(
        `SELECT (SELECT COUNT(*) FROM users WHERE id = ?)
              + (SELECT COUNT(*) FROM assistant_requests WHERE user_id = ?) AS remaining`,
        [applicant.id, applicant.id],
      );
      assert.equal(remaining, 0);
    });

    it('leaves a deactivated applicant out of the pending requests and their count', async () => {
      const waiting = await signUpAssistant();
      const deactivated = await signUpAssistant();
      const pendingIds = async () =>
        (await requests(admin, '&status=pending')).map((request) => request.userId);
      // The nav badge reads the total of this query.
      const pendingTotal = async () =>
        (await api.get('/api/v1/assistant-requests?status=pending&limit=1').set(as(admin))).body.meta.total;
      assert.ok((await pendingIds()).includes(deactivated.id));
      const before = await pendingTotal();

      const res = await api
        .patch(`/api/v1/users/${deactivated.id}/status`)
        .set(as(admin))
        .send({ isActive: false });
      expectStatus(res, 200);
      const ids = await pendingIds();
      assert.ok(ids.includes(waiting.id));
      assert.ok(!ids.includes(deactivated.id));
      assert.equal(await pendingTotal(), before - 1);
      // Still listed among all requests, with the account shown as deactivated.
      const listed = (await requests(admin)).find((request) => request.userId === deactivated.id);
      assert.deepEqual([listed.status, listed.isActive], ['pending', false]);
    });

    it('keeps the account of whoever decided a request (it is history)', async () => {
      const decider = await makeUser('admin');
      const applicant = await signUpAssistant();
      expectStatus(await decline(decider, applicant.id, { reason: 'Not this year.' }), 200);
      expectRefused(await api.delete(`/api/v1/users/${decider.id}`).set(as(admin)), 409, 'has_history');
    });

    it('never comes from POST /users, for anyone', async () => {
      const assistant = await makeAssistant();
      for (const who of [admin, assistant]) {
        const body = { role: 'assistant', ...accountFields() };
        const res = await api.post('/api/v1/users').set(as(who)).send(body);
        expectStatus(res, 400);
        assert.match(res.body.error.details.issues[0].message, /sign up themselves/);
        const [{ n }] = await query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [body.email]);
        assert.equal(n, 0);
      }
    });

    it('counts an assistant without a request (created before sign-up) as approved', async () => {
      const veteran = await makeAssistant();
      await run('DELETE FROM assistant_requests WHERE user_id = ?', [veteran.id]);
      assert.equal((await me(veteran)).assistantRequest, null);
      expectStatus(await api.get('/api/v1/students').set(as(veteran)), 200);
      expectStatus(await api.get('/api/v1/assistant-requests').set(as(veteran)), 200);
    });
  });
});
