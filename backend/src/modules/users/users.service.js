/**
 * Accounts: the one code path that creates a person in Firebase and MySQL,
 * account reads, office edits, activation status and deletion of unused accounts.
 * An admin manages every account; a student assistant creates and edits student accounts only.
 * Student assistants are never created by the office: they sign up themselves and wait for approval
 * (assistantRequests).
 */
import { withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { firebase } from '../../config/firebase.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';
import { assertAdmin } from '../access/access.service.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import * as notifications from '../notifications/notifications.service.js';
import * as admissions from '../admissions/admissions.service.js';
import * as announcements from '../announcements/announcements.service.js';
import * as assistantRequests from '../assistantRequests/assistantRequests.service.js';
import { teacherHasAssignments } from '../classSubjects/classSubjects.service.js';
import { closeActiveForStudent } from '../enrollments/enrollments.service.js';
import * as studentsService from '../students/students.service.js';
import * as teachersService from '../teachers/teachers.service.js';
import * as repo from './users.repository.js';
import { ASSISTANT_SIGNUP_ONLY } from './users.schemas.js';

const toUserShape = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.firstName,
  lastName: row.lastName,
  phone: row.phone,
  role: row.role,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Identity + role profile (+ current enrollment for students, + where the sign-up stands for student
 * assistants): the shape of /auth/me and /users/:id.
 */
export async function getAccount(id) {
  const user = ApiError.assertFound(await repo.findUserById(id), 'user', id);
  const account = {
    ...toUserShape(user),
    firebaseUid: user.firebaseUid,
    studentId: null,
    teacherId: null,
    profile: null,
  };
  if (user.role === 'student') {
    const { profile, currentEnrollment } = await studentsService.getProfileByUserId(id);
    Object.assign(account, { studentId: profile.id, profile, currentEnrollment });
  } else if (user.role === 'teacher') {
    const profile = await teachersService.getProfileByUserId(id);
    Object.assign(account, { teacherId: profile.id, profile });
  } else if (user.role === 'assistant') {
    account.assistantRequest = await assistantRequests.requestOf(id);
  }
  return account;
}

export async function listUsers(listQuery) {
  const { rows, meta } = await repo.listUsers(listQuery);
  return { data: rows.map(toUserShape), meta };
}

/** 403 unless `actor` may manage an account of `role`: an admin any, a student assistant students' only. */
function assertMayManageAccountOf(actor, role) {
  if (role !== 'student') assertAdmin(actor, 'student assistants can only manage student accounts');
}

/**
 * POST /users: the office creates an account (a student assistant, a student account only). Never a student
 * assistant, for anyone: they sign up themselves and wait for approval. The body schema refuses the role
 * already; this keeps the rule should the schema change.
 */
export async function createAccount(actor, body) {
  if (body.role === 'assistant') {
    throw ApiError.validation(ASSISTANT_SIGNUP_ONLY, 'body', {
      reason: 'assistant_signup_only',
      field: 'role',
    });
  }
  assertMayManageAccountOf(actor, body.role);
  return createUserAccount(body, { trusted: true });
}

/** PATCH /users/:id: the office edits an account's name and phone (a student assistant, a student's only). */
export async function editAccount(actor, id, patch) {
  const target = ApiError.assertFound(await repo.findUserById(id), 'user', id);
  assertMayManageAccountOf(actor, target.role);
  return updateUser(id, patch);
}

/** Name and phone of any account, unchecked: editAccount (the office) and PATCH /auth/me (one's own). */
export async function updateUser(id, patch) {
  const before = ApiError.assertFound(await repo.findUserById(id), 'user', id);
  await repo.updateUser(id, patch);
  const account = await getAccount(id);
  const changes = changesOf(before, patch);
  if (changes) {
    await record({
      action: 'user.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of ${nameOf(account)}`,
      details: { email: account.email, changes },
    });
  }
  return account;
}

async function findFirebaseUserByEmail(email) {
  try {
    return await firebase.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

const emailAlreadyRegistered = () =>
  ApiError.conflict('email already registered', { key: 'users.uq_users_email' });

const emailInUse = (message = 'this email is already in use; contact an administrator') =>
  ApiError.conflict(message, { key: 'users.uq_users_email', reason: 'email_in_use' });

/**
 * Creates the Firebase account of a new person and returns its uid. The caller has checked that no
 * MySQL row uses the email. An existing Firebase user with it is never reused: anyone can create a
 * Firebase user with the public web key and keep its ID token, and reusing that uid would hand them
 * the new account. Public registration refuses it (409). Trusted callers (the office, import) replace it
 * with a fresh user, but only when it is linked to no account here (an account whose email was changed
 * in Firebase keeps its sign-in) and only outside local development, where the Firebase project is
 * usually shared with the live site and the user may be a live account.
 */
async function createFirebaseUser({ email, password, displayName }, trusted) {
  const existing = await findFirebaseUserByEmail(email);
  if (existing) {
    if (!trusted) throw emailInUse();
    // Re-checked right before the delete: a concurrent create of the same email may have just linked this uid.
    if (await repo.findUserByEmail(email)) throw emailAlreadyRegistered();
    if (await repo.findUserByFirebaseUid(existing.uid)) {
      throw emailInUse('this email signs in to another school account; contact an administrator');
    }
    if (!env.replacesUnlinkedFirebaseUsers) {
      throw emailInUse(
        'this email already has a sign-in in the shared Firebase project (it may belong to the live site); use another email',
      );
    }
    await firebase.deleteUser(existing.uid);
    logger.warn('deleted a Firebase user that had no school account', { email, uid: existing.uid });
  }
  const record = await firebase.createUser({ email, password, displayName, emailVerified: trusted });
  return record.uid;
}

const isGeneratedNumberCollision = (error, profile) =>
  error?.code === 'ER_DUP_ENTRY' &&
  /uq_(students|teachers)_number/.test(error.sqlMessage ?? '') &&
  !profile?.studentNumber &&
  !profile?.employeeNumber;

/**
 * Create a person in Firebase Authentication and MySQL.
 *
 *   1. email already in MySQL        -> 409 CONFLICT (key users.uq_users_email)
 *   2. Firebase account for the email -> see createFirebaseUser
 *   3. users + profile rows, the application of a self-registered student, and the pending request of a student
 *      assistant, in ONE transaction (a generated business number that collides with a parallel sign-up is
 *      regenerated, up to 5 attempts)
 *   4. MySQL write failed -> delete the Firebase user this call created (no orphans); a failure after the
 *      commit leaves both in place
 *
 * Every student assistant created here waits for the school office's approval: assistants come from public
 * registration only (POST /users refuses the role).
 *
 * @param {{ email: string, password: string, role: 'admin'|'teacher'|'student'|'assistant',
 *           firstName: string, lastName: string, phone?: string, profile?: object,
 *           application?: { gradeLevel: number, previousSchool?: string|null } }} input
 *   `application` is sent by public registration only: office-created and imported students have none
 * @param {{ trusted: boolean, firebaseUid?: string }} options trusted = the office, import or seed;
 *   firebaseUid links an existing Firebase user instead of creating one (the seed's demo accounts only)
 */
export async function createUserAccount(input, { trusted, firebaseUid }) {
  const email = input.email.toLowerCase();
  if (await repo.findUserByEmail(email)) throw emailAlreadyRegistered();

  const uid =
    firebaseUid ??
    (await createFirebaseUser(
      { email, password: input.password, displayName: `${input.firstName} ${input.lastName}` },
      trusted,
    ));

  const insertAll = () =>
    withTransaction(async (conn) => {
      const userId = await repo.insertUser({ ...input, email, firebaseUid: uid }, conn);
      if (input.role === 'student') {
        const studentId = await studentsService.createProfile(userId, input.profile, conn);
        if (input.application) await admissions.createApplication(studentId, input.application, conn);
      }
      if (input.role === 'teacher') await teachersService.createProfile(userId, input.profile, conn);
      if (input.role === 'assistant') await assistantRequests.createRequest(userId, conn);
      return userId;
    });

  // Only a failed MySQL write removes the Firebase user: once the rows are committed, the account exists,
  // and an error while reading it back must not leave a row whose Firebase user is gone.
  let userId;
  try {
    userId = await insertWithFreshNumber(insertAll, input.profile);
  } catch (error) {
    // A linked (pre-existing) Firebase user is not this call's to remove.
    if (!firebaseUid) await deleteFirebaseUserOrLog(uid, 'could not delete Firebase user after a failure');
    throw error;
  }
  const account = await getAccount(userId);
  const details = { email, role: input.role };
  if (trusted) {
    await record({
      action: 'user.create',
      entityId: userId,
      summary: `Created the ${input.role} account of ${nameOf(account)} (${email})`,
      details,
    });
  } else {
    // A public sign-up has no signed-in user: the new account is its own actor.
    await record({
      action: 'user.register',
      entityId: userId,
      summary: `${nameOf(account)} signed up as a ${input.role === 'assistant' ? 'student assistant' : 'student'} (${email})`,
      details,
      actor: account,
    });
    await notifications.notifyOffice(signupNote(account));
  }
  return account;
}

/** The office's notification of a public sign-up: a student's application, or a student assistant's request. */
function signupNote(account) {
  if (account.role === 'assistant') {
    return {
      type: 'signup',
      title: `Student assistant request: ${nameOf(account)}`,
      body: account.email,
      link: notifications.assistantSignupLink(account.id),
    };
  }
  const application = account.profile.admission;
  return {
    type: 'signup',
    title: `New application: ${nameOf(account)}`,
    body: application ? `Grade ${application.gradeLevel} · ${account.email}` : account.email,
    link: notifications.signupLink(account.studentId),
  };
}

/** Tries a generated student or employee number this many times when parallel sign-ups take the same one. */
const GENERATED_NUMBER_ATTEMPTS = 5;

/** Runs `insert`, regenerating the business number (a new attempt reads the new maximum) while it collides. */
async function insertWithFreshNumber(insert, profile) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await insert();
    } catch (error) {
      if (attempt >= GENERATED_NUMBER_ATTEMPTS || !isGeneratedNumberCollision(error, profile)) throw error;
    }
  }
}

/** Best effort: a leftover Firebase user without a MySQL row cannot sign in (403 USER_NOT_REGISTERED). */
async function deleteFirebaseUserOrLog(uid, message) {
  await firebase
    .deleteUser(uid)
    .catch((cleanupError) => logger.error(message, { uid, cleanupError: String(cleanupError) }));
}

/** Inside `conn`'s transaction: 409 when taking admin `id` out of the active admins would leave none. */
async function assertNotLastActiveAdmin(id, conn) {
  const activeAdminIds = await repo.lockActiveAdminIds(conn);
  if (activeAdminIds.every((adminId) => adminId === id)) {
    throw ApiError.conflict('at least one active administrator must remain', { reason: 'last_admin' });
  }
}

/** Applies an account's status to its Firebase sign-in (ending its sessions on deactivation); 503 on failure. */
async function applySignInStatus(firebaseUid, isActive) {
  try {
    await firebase.updateUser(firebaseUid, { disabled: !isActive });
    if (!isActive) await firebase.revokeRefreshTokens(firebaseUid);
  } catch (error) {
    throw ApiError.unavailable('auth', { cause: error });
  }
}

/**
 * Activate / deactivate. The side that refuses the person goes first, so a failure in between never shows
 * an account as active that cannot sign in: deactivating writes MySQL first (the middleware enforces it on
 * the next request), then Firebase (disabled flag and refresh-token revocation); reactivating enables the
 * Firebase sign-in first, then MySQL. A failed Firebase step answers 503; repeating the request finishes it.
 * Deactivating an admin re-checks the "last active admin" rule under row locks, so two admins
 * deactivating each other at the same moment cannot both succeed.
 */
export async function setStatus(actor, id, isActive) {
  if (actor.id === id)
    throw ApiError.forbidden('self_status_change', 'you cannot change your own account status');
  const target = await getAccount(id);

  // Until MySQL says active the API still refuses the account: an enabled sign-in alone grants nothing.
  if (isActive) await applySignInStatus(target.firebaseUid, true);

  await withTransaction(async (conn) => {
    // Status changes of one account run one after the other. Deactivating an admin locks every active
    // admin in id order (assertNotLastActiveAdmin); locking the target first would deadlock two admins
    // deactivating each other.
    if (!isActive && target.role === 'admin') await assertNotLastActiveAdmin(id, conn);
    else await repo.lockUser(id, conn);
    // This year and any later one: next year's classes may already be set up with this teacher.
    if (
      !isActive &&
      target.isActive &&
      target.role === 'teacher' &&
      (await teacherHasAssignments(target.teacherId, currentAcademicYear(), conn))
    ) {
      throw ApiError.conflict("reassign this teacher's subjects and homeroom class before deactivating", {
        reason: 'teacher_has_assignments',
      });
    }
    await repo.setActive(id, isActive, conn);
    if (!isActive && target.role === 'student')
      await closeActiveForStudent(target.studentId, 'withdrawn', conn);
  });

  // Logged as soon as MySQL has it: the account is (de)activated from here on, whatever Firebase says.
  if (target.isActive !== isActive) {
    const withdrawn = !isActive && target.role === 'student' && target.currentEnrollment;
    await record({
      action: isActive ? 'user.activate' : 'user.deactivate',
      entityId: id,
      summary: `${isActive ? 'Reactivated' : 'Deactivated'} the ${target.role} account of ${nameOf(target)}${
        withdrawn ? ` (withdrawn from ${target.currentEnrollment.className})` : ''
      }`,
      details: { email: target.email, role: target.role },
    });
  }

  // A deactivation's sign-in follows. The account is already refused by the API (MySQL is checked on every
  // request); a failure here answers 503, and repeating the same request re-applies the Firebase step.
  if (!isActive) await applySignInStatus(target.firebaseUid, false);
  return getAccount(id);
}

const hasHistoryConflict = (options) =>
  ApiError.conflict(
    'this account already has school records; deactivate it instead',
    { reason: 'has_history' },
    options,
  );

/**
 * Permanent removal of an account created by mistake (email and role cannot be edited, and a
 * deactivated account keeps its email). Only an account nothing refers to can go; FK RESTRICT is
 * the backstop when a record is added concurrently. MySQL (profile + users row, one transaction)
 * first, then the Firebase user.
 */
export async function deleteUser(actor, id) {
  if (actor.id === id) throw ApiError.forbidden('self', 'you cannot delete your own account');
  const target = ApiError.assertFound(await repo.findUserById(id), 'user', id);

  try {
    await withTransaction(async (conn) => {
      if (target.role === 'admin') await assertNotLastActiveAdmin(id, conn);
      if (await repo.hasHistory(id, conn)) throw hasHistoryConflict();
      if (target.role === 'student') {
        // An application is not history: an applicant who was never placed in a class can still go.
        await admissions.deleteForUser(id, conn);
        await studentsService.deleteProfile(id, conn);
      }
      if (target.role === 'teacher') await teachersService.deleteProfile(id, conn);
      // Nor is a sign-up request: a declined (or never used) student assistant account can still go.
      if (target.role === 'assistant') await assistantRequests.deleteForUser(id, conn);
      await notifications.deleteForUser(id, conn);
      await announcements.deleteReadsOfUser(id, conn);
      if (!(await repo.deleteUser(id, conn))) throw ApiError.notFound('user', id);
    });
  } catch (error) {
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') throw hasHistoryConflict({ cause: error });
    throw error;
  }

  await deleteFirebaseUserOrLog(
    target.firebaseUid,
    'could not delete the Firebase user of a deleted account',
  );
  await record({
    action: 'user.delete',
    entityId: id,
    summary: `Deleted the unused ${target.role} account of ${nameOf(target)} (${target.email})`,
    details: { email: target.email, role: target.role },
  });
  return { id };
}
