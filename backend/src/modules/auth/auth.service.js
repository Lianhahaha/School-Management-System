/**
 * Registration and the signed-in user's own account.
 */
import { ApiError } from '../../utils/ApiError.js';
import * as studentsService from '../students/students.service.js';
import * as usersService from '../users/users.service.js';

const STUDENT_ONLY_FIELDS = ['address', 'guardianName', 'guardianPhone'];

const isEmailTaken = (error) =>
  (error instanceof ApiError && error.details?.key === 'users.uq_users_email') ||
  (error?.code === 'ER_DUP_ENTRY' && /uq_users_email/.test(error.sqlMessage ?? ''));

/**
 * Public registration always creates a student with a pending application (the grade applied for and the
 * previous school); the Firebase account is never adopted. Every "this email is taken" case (a school
 * account, a sign-in without one, a parallel sign-up) gets the same answer, so the form does not tell
 * strangers which kind of account an address has.
 */
export async function register(body) {
  const { email, password, firstName, lastName, phone, gradeLevel, previousSchool, ...profile } = body;
  try {
    return await usersService.createUserAccount(
      {
        email,
        password,
        firstName,
        lastName,
        phone,
        role: 'student',
        profile,
        application: { gradeLevel, previousSchool },
      },
      { trusted: false },
    );
  } catch (error) {
    if (!isEmailTaken(error)) throw error;
    throw ApiError.conflict(
      'this email is already registered; sign in, or contact an administrator',
      { key: 'users.uq_users_email', reason: 'email_in_use' },
      { cause: error },
    );
  }
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
