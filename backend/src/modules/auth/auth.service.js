/**
 * Registration, the demo sign-in and the signed-in user's own account.
 */
import { env } from '../../config/env.js';
import { firebase } from '../../config/firebase.js';
import { ApiError } from '../../utils/ApiError.js';
import * as studentsService from '../students/students.service.js';
import * as usersService from '../users/users.service.js';

const STUDENT_ONLY_FIELDS = ['address', 'guardianName', 'guardianPhone'];

const isEmailTaken = (error) =>
  (error instanceof ApiError && error.details?.key === 'users.uq_users_email') ||
  (error?.code === 'ER_DUP_ENTRY' && /uq_users_email/.test(error.sqlMessage ?? ''));

/**
 * The account a registration body describes: a student with an application, or a student assistant. Both
 * carry the Privacy Notice the person agreed to (the schema accepts the current one only).
 */
function accountOf(body) {
  const { accountType, email, password, firstName, lastName, phone, privacyNoticeVersion, ...rest } = body;
  const identity = { email, password, firstName, lastName, phone, privacyNoticeVersion };
  if (accountType === 'assistant') return { ...identity, role: 'assistant' };
  const { gradeLevel, previousSchool, ...profile } = rest;
  return { ...identity, role: 'student', profile, application: { gradeLevel, previousSchool } };
}

/**
 * Public registration creates a student with a pending application (the grade applied for and the previous
 * school), who then picks a section of that grade (POST /enrollments/next-class), or a student assistant whose
 * request waits for the school office's approval; the Firebase account is never adopted. Every "this email is
 * taken" case (a school account, a sign-in without one, a parallel sign-up) gets the same answer, so the form
 * does not tell strangers which kind of account an address has.
 */
export async function register(body) {
  try {
    return await usersService.createUserAccount(accountOf(body), { trusted: false });
  } catch (error) {
    if (!isEmailTaken(error)) throw error;
    throw ApiError.conflict(
      'this email is already registered; sign in, or contact an administrator',
      { key: 'users.uq_users_email', reason: 'email_in_use' },
      { cause: error },
    );
  }
}

/**
 * The demo account (DEMO_ACCOUNT_EMAIL): a real, active account of any role that anyone may sign in as from the
 * sign-in page. 404 `demo_disabled` while the account does not exist or is deactivated, so the page shows no demo
 * and a sign-in is never offered that would fail.
 */
async function demoAccount() {
  const user = await usersService.findUserByEmail(env.DEMO_ACCOUNT_EMAIL);
  if (!user?.isActive) throw ApiError.notFound('route', '/auth/demo', { reason: 'demo_disabled' });
  return user;
}

/** Who the sign-in page offers: the demo account's name and role. */
export async function getDemo() {
  const { firstName, lastName, role } = await demoAccount();
  return { firstName, lastName, role };
}

/** A Firebase custom token for the demo account; the client signs in with it (signInWithCustomToken). */
export async function signInDemo() {
  const { firebaseUid } = await demoAccount();
  return { customToken: await firebase.createCustomToken(firebaseUid) };
}

export const getMe = (user) => usersService.getAccount(user.id);

export async function updateMe(user, patch) {
  if (user.role === 'student') {
    await studentsService.updateStudent(user.studentId, patch);
    return usersService.getAccount(user.id);
  }
  const rejected = STUDENT_ONLY_FIELDS.filter((field) => field in patch);
  if (rejected.length) {
    throw ApiError.validation(`only students can update: ${rejected.join(', ')}`, 'body', {
      reason: 'student_only_fields',
    });
  }
  return usersService.updateUser(user.id, patch);
}
