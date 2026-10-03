/**
 * Registration and the signed-in user's own account.
 */
import { ApiError } from '../../utils/ApiError.js';
import * as studentsService from '../students/students.service.js';
import * as usersService from '../users/users.service.js';

const STUDENT_ONLY_FIELDS = ['address', 'guardianName', 'guardianPhone'];

/** Public registration always creates a student; the Firebase account is never adopted. */
export function register(body) {
  const { email, password, firstName, lastName, phone, ...profile } = body;
  return usersService.createUserAccount(
    { email, password, firstName, lastName, phone, role: 'student', profile },
    { trusted: false },
  );
}

export const getMe = (user) => usersService.getAccount(user.id);

export async function updateMe(user, patch) {
  if (user.studentId) {
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
