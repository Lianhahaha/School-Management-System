/**
 * Accounts: the one code path that creates a person in Firebase and MySQL,
 * account reads, admin edits and activation status.
 */
import { withTransaction } from '../../config/db.js';
import { firebase } from '../../config/firebase.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';
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
  ApiError.assertFound(await repo.findUserById(id), 'user', id);
  await repo.updateUser(id, patch);
  return getAccount(id);
}

/**
 * Finds or creates the Firebase account for an email.
 * Trusted callers (admin, seed) adopt an existing account and reset its password; public
 * registration never adopts: an existing Firebase user without a MySQL row is a 409.
 */
async function resolveFirebaseUser({ email, password, displayName }, trusted) {
  let existing = null;
  try {
    existing = await firebase.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }
  if (existing) {
    if (!trusted) {
      throw ApiError.conflict('this email is already in use; contact an administrator', {
        key: 'users.uq_users_email',
        reason: 'email_in_use',
      });
    }
    await firebase.updateUser(existing.uid, { password, displayName, disabled: false });
    logger.info('adopted existing Firebase user', { email, uid: existing.uid });
    return { uid: existing.uid, created: false };
  }
  const record = await firebase.createUser({ email, password, displayName, emailVerified: trusted });
  return { uid: record.uid, created: true };
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
 *   2. Firebase account for the email -> see resolveFirebaseUser
 *   3. users + profile rows in ONE transaction (a generated business number that collides is regenerated once)
 *   4. MySQL failed and this call created the Firebase user -> delete it again (no orphans)
 *
 * @param {{ email: string, password: string, role: 'admin'|'teacher'|'student', firstName: string,
 *           lastName: string, phone?: string, profile?: object }} input
 * @param {{ trusted: boolean }} options trusted = admin or seed
 */
export async function createUserAccount(input, { trusted }) {
  const email = input.email.toLowerCase();
  if (await repo.findUserByEmail(email)) {
    throw ApiError.conflict('email already registered', { key: 'users.uq_users_email' });
  }

  const { uid, created } = await resolveFirebaseUser(
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

  try {
    let userId;
    try {
      userId = await insertAll();
    } catch (error) {
      if (!isGeneratedNumberCollision(error, input.profile)) throw error;
      userId = await insertAll();
    }
    return await getAccount(userId);
  } catch (error) {
    if (created) {
      await firebase.deleteUser(uid).catch((cleanupError) =>
        logger.error('could not delete Firebase user after a failure', {
          uid,
          cleanupError: String(cleanupError),
        }),
      );
    }
    throw error;
  }
}

/**
 * Activate / deactivate. MySQL first (the middleware enforces it on the next request),
 * then Firebase (disabled flag, plus refresh-token revocation when deactivating).
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
    await repo.setActive(id, isActive, conn);
    if (!isActive && target.role === 'student')
      await closeActiveForStudent(target.studentId, 'withdrawn', conn);
  });

  await firebase.updateUser(target.firebaseUid, { disabled: !isActive });
  if (!isActive) await firebase.revokeRefreshTokens(target.firebaseUid);

  return getAccount(id);
}
