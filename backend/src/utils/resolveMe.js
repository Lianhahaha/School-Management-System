/**
 * Resolves the literal `me` to the caller's own id. Accepted wherever a
 * studentId, teacherId or userId (author) appears in a path or filter.
 */
import { ApiError } from './ApiError.js';

const FIELDS = { student: 'studentId', teacher: 'teacherId', user: 'id' };

/**
 * @param {object} user   req.user
 * @param {number|'me'|undefined} value
 * @param {'student'|'teacher'|'user'} kind
 * @returns {number|undefined}
 */
export function resolveMe(user, value, kind) {
  if (value !== 'me') return value;
  const resolved = user[FIELDS[kind]];
  if (resolved == null) {
    throw ApiError.validation(`'me' cannot be resolved: the caller has no ${kind} profile`, undefined, {
      reason: 'me_not_resolvable',
    });
  }
  return resolved;
}
