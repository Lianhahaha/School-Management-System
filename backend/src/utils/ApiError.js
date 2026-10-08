/**
 * ApiError — the only error type services and middleware throw on purpose.
 *
 * Every instance maps 1:1 to the error envelope:
 *   { success: false, error: { code, message, details? } }
 * `code` is always one of ERROR_CODES (the closed catalogue); specifics go in
 * `details` (`reason`, `key`, `issues`, `conflicts`, ...). Use the static
 * factories below — never construct codes by hand — so that
 * `grep "ApiError\."` lists every failure path of a module.
 *
 * Factories that replace a lower-level failure take a trailing `{ cause }`:
 * the original error is never sent to the client, but errorHandler logs it.
 */
import { ERROR_CODES } from '../constants/shared.js';

/** Words people use for a missing record (`details.resource` keeps the internal name). */
const RESOURCE_NAMES = {
  'class subject': 'subject of this class',
  schedule: 'period',
};

/** Words people use for a dependency that is down (`details.component` keeps the internal name). */
const COMPONENT_NAMES = { db: 'the database', auth: 'sign-in', timetable: 'the schedule' };

export class ApiError extends Error {
  constructor(status, code, message, details, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * 400 — zod issues (`part` prefixes paths: "body.email") or a business-rule
   * message with optional details ({ reason, field, invalidStudentIds, ... }).
   */
  static validation(zodErrorOrMessage, part, details, options) {
    if (typeof zodErrorOrMessage === 'string') {
      return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, zodErrorOrMessage, details, options);
    }
    const issues = zodErrorOrMessage.issues.map((issue) => ({
      path: [part, ...issue.path].filter((segment) => segment !== undefined && segment !== '').join('.'),
      message: issue.message,
    }));
    return new ApiError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'request validation failed',
      { issues, ...details },
      options,
    );
  }

  static unauthorized(message = 'authentication required', reason, options) {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message, reason ? { reason } : undefined, options);
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

  /** 404 for `resource` / `id`; `details` adds specifics such as a `reason`. */
  static notFound(resource, id, details) {
    const name = RESOURCE_NAMES[resource] ?? resource;
    return new ApiError(404, ERROR_CODES.NOT_FOUND, `${name} not found`, { resource, id, ...details });
  }

  /** Returns `row` when it exists, otherwise throws 404 for `resource` / `id`. */
  static assertFound(row, resource, id) {
    if (row === null || row === undefined) throw ApiError.notFound(resource, id);
    return row;
  }

  static conflict(message, details, options) {
    return new ApiError(409, ERROR_CODES.CONFLICT, message, details, options);
  }

  static scheduleConflict(conflicts) {
    return new ApiError(
      409,
      ERROR_CODES.SCHEDULE_CONFLICT,
      conflicts.length === 1
        ? 'this period clashes with another period'
        : `this period clashes with ${conflicts.length} other periods`,
      { conflicts },
    );
  }

  static rateLimited(retryAfterSeconds) {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, 'too many requests, try again later', {
      retryAfterSeconds,
    });
  }

  static internal(message = 'internal server error', options) {
    return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message, undefined, options);
  }

  /** 503 — a dependency (`db`, `auth`, `timetable`, ...) cannot serve the request right now. */
  static unavailable(component = 'db', options) {
    return new ApiError(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      `${COMPONENT_NAMES[component] ?? component} cannot be reached right now, try again in a moment`,
      { component },
      options,
    );
  }

  /** 503 — the database is up but refused this attempt (deadlock, lock wait, full queue); a retry should work. */
  static busy(options) {
    return new ApiError(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'the database is busy, try again in a moment',
      { component: 'db', reason: 'busy' },
      options,
    );
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { success: false, error };
  }
}
