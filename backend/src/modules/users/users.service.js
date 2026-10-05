/**
 * Accounts: the one code path that creates a person in Firebase and MySQL,
 * account reads, admin edits, activation status and deletion of unused accounts.
 */
import { withTransaction } from '../../config/db.js';
import { firebase } from '../../config/firebase.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import { teacherHasAssignments } from '../classSubjects/classSubjects.service.js';
import { closeActiveForStudent } from '../enrollments/enrollments.service.js';
import * as studentsService from '../students/students.service.js';
import * as teachersService from '../teachers/teachers.service.js';
import * as repo from './users.repository.js';

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

/** Identity + role profile (+ current enrollment for students): the shape of /auth/me and /users/:id. */
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
  }
  return account;
}

export async function listUsers(listQuery) {
  const { rows, meta } = await repo.listUsers(listQuery);
  return { data: rows.map(toUserShape), meta };
}

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

/**
 * Creates the Firebase account of a new person and returns its uid. The caller has checked that no
 * MySQL row uses the email, so an existing Firebase user with it belongs to nobody in the school.
 * It is never reused: anyone can create a Firebase user with the public web key and keep its ID token,
 * and reusing that uid would hand them the new account. Public registration refuses it (409); trusted
 * callers (admin, seed) delete it and create a fresh user with a new uid.
 */
async function createFirebaseUser({ email, password, displayName }, trusted) {
  const existing = await findFirebaseUserByEmail(email);
  if (existing) {
    if (!trusted) {
      throw ApiError.conflict('this email is already in use; contact an administrator', {
        key: 'users.uq_users_email',
        reason: 'email_in_use',
      });
    }
    // Re-checked right before the delete: a concurrent create of the same email may have just linked this uid.
    if (await repo.findUserByEmail(email)) throw emailAlreadyRegistered();
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
 *   3. users + profile rows in ONE transaction (a generated business number that collides with a parallel
 *      sign-up is regenerated, up to 5 attempts)
 *   4. MySQL write failed -> delete the Firebase user this call created (no orphans); a failure after the
 *      commit leaves both in place
 *
 * @param {{ email: string, password: string, role: 'admin'|'teacher'|'student', firstName: string,
 *           lastName: string, phone?: string, profile?: object }} input
 * @param {{ trusted: boolean }} options trusted = admin or seed
 */
export async function createUserAccount(input, { trusted }) {
  const email = input.email.toLowerCase();
  if (await repo.findUserByEmail(email)) throw emailAlreadyRegistered();

  const uid = await createFirebaseUser(
    { email, password: input.password, displayName: `${input.firstName} ${input.lastName}` },
    trusted,
  );

  const insertAll = () =>
    withTransaction(async (conn) => {
      const userId = await repo.insertUser({ ...input, email, firebaseUid: uid }, conn);
      if (input.role === 'student') await studentsService.createProfile(userId, input.profile, conn);
      if (input.role === 'teacher') await teachersService.createProfile(userId, input.profile, conn);
      return userId;
    });

  // Only a failed MySQL write removes the Firebase user: once the rows are committed, the account exists,
  // and an error while reading it back must not leave a row whose Firebase user is gone.
  let userId;
  try {
    userId = await insertWithFreshNumber(insertAll, input.profile);
  } catch (error) {
    await deleteFirebaseUserOrLog(uid, 'could not delete Firebase user after a failure');
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
      summary: `${nameOf(account)} signed up as a student (${email})`,
      details,
      actor: account,
    });
  }
  return account;
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

/**
 * Activate / deactivate. MySQL first (the middleware enforces it on the next request),
 * then Firebase (disabled flag, plus refresh-token revocation when deactivating).
 * Deactivating an admin re-checks the "last active admin" rule under row locks, so two admins
 * deactivating each other at the same moment cannot both succeed.
 */
export async function setStatus(actor, id, isActive) {
  if (actor.id === id)
    throw ApiError.forbidden('self_status_change', 'you cannot change your own account status');
  const target = await getAccount(id);

  if (!isActive && target.isActive) {
    if (target.role === 'teacher' && (await teacherHasAssignments(target.teacherId, currentAcademicYear()))) {
      throw ApiError.conflict("reassign this teacher's subjects and homeroom class before deactivating", {
        reason: 'teacher_has_assignments',
      });
    }
  }

  await withTransaction(async (conn) => {
    if (!isActive && target.role === 'admin') await assertNotLastActiveAdmin(id, conn);
    await repo.setActive(id, isActive, conn);
    if (!isActive && target.role === 'student')
      await closeActiveForStudent(target.studentId, 'withdrawn', conn);
  });

  await firebase.updateUser(target.firebaseUid, { disabled: !isActive });
  if (!isActive) await firebase.revokeRefreshTokens(target.firebaseUid);

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
      if (target.role === 'student') await studentsService.deleteProfile(id, conn);
      if (target.role === 'teacher') await teachersService.deleteProfile(id, conn);
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
