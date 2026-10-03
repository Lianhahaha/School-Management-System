/**
 * ApiError — the only error type services and middleware throw on purpose.
 *
 * Every instance maps 1:1 to the error envelope:
 *   { success: false, error: { code, message, details? } }
 * `code` is always one of ERROR_CODES (the closed catalogue); specifics go in
 * `details` (`reason`, `key`, `issues`, `conflicts`, ...). Use the static
 * factories below — never construct codes by hand — so that
 * `grep "ApiError\."` lists every failure path of a module.
 */
import { ERROR_CODES } from '../constants/shared.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * 400 — zod issues (`part` prefixes paths: "body.email") or a business-rule
   * message with optional details ({ reason, field, invalidStudentIds, ... }).
   */
  static validation(zodErrorOrMessage, part, details) {
    if (typeof zodErrorOrMessage === 'string') {
      return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, zodErrorOrMessage, details);
    }
    const issues = zodErrorOrMessage.issues.map((issue) => ({
      path: [part, ...issue.path].filter((segment) => segment !== undefined && segment !== '').join('.'),
      message: issue.message,
    }));
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'request validation failed', {
      issues,
      ...details,
    });
  }

  static unauthorized(message = 'authentication required', reason) {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message, reason ? { reason } : undefined);
  }

  static notRegistered(firebaseUid) {
    return new ApiError(
      403,
      ERROR_CODES.USER_NOT_REGISTERED,
      'this account is not registered in the school system; contact an administrator',
      { firebaseUid },
    );
  }

  static accountDisabled() {
    return new ApiError(403, ERROR_CODES.ACCOUNT_DISABLED, 'this account has been deactivated');
  }

  static forbidden(reason = 'not_allowed', message = 'you are not allowed to perform this action') {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message, { reason });
  }

  static notFound(resource, id) {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`, { resource, id });
  }

  /** Returns `row` when it exists, otherwise throws 404 for `resource` / `id`. */
  static assertFound(row, resource, id) {
    if (row === null || row === undefined) throw ApiError.notFound(resource, id);
    return row;
  }

  static conflict(message, details) {
    return new ApiError(409, ERROR_CODES.CONFLICT, message, details);
  }

  static scheduleConflict(conflicts) {
    return new ApiError(
      409,
      ERROR_CODES.SCHEDULE_CONFLICT,
      `schedule overlaps ${conflicts.length} existing schedule(s)`,
      { conflicts },
    );
  }

  static rateLimited(retryAfterSeconds) {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, 'too many requests, try again later', {
      retryAfterSeconds,
    });
  }

  static internal(message = 'internal server error') {
    return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }

  static unavailable(component = 'db') {
    return new ApiError(503, ERROR_CODES.SERVICE_UNAVAILABLE, `${component} unavailable`, { component });
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { success: false, error };
  }
}
