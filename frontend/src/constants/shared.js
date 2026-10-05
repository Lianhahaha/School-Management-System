/**
 * Shared constants — the single source of truth for every value that must be
 * identical in the database (ENUM columns), the API (zod schemas, responses)
 * and the user interface (selects, badges, filters).
 *
 * This file exists twice, byte for byte:
 *   backend/src/constants/shared.js
 *   frontend/src/constants/shared.js
 * `npm run check:constants` (backend) fails the build when the two copies
 * differ or when an ENUM column in database/schema.sql does not match.
 *
 * Rules for this file: pure ES module, no imports, no environment access,
 * no framework code. Values only, plus the two tiny helpers at the bottom.
 */

export const ROLES = Object.freeze(['admin', 'teacher', 'student']);

export const GENDERS = Object.freeze(['male', 'female', 'other']);

export const ENROLLMENT_STATUSES = Object.freeze(['active', 'completed', 'transferred', 'withdrawn']);

export const ATTENDANCE_STATUSES = Object.freeze(['present', 'absent', 'late', 'excused']);

export const ASSESSMENT_TYPES = Object.freeze(['quiz', 'test', 'exam', 'assignment', 'project', 'other']);

export const TERMS = Object.freeze(['term1', 'term2', 'term3']);

export const ANNOUNCEMENT_AUDIENCES = Object.freeze(['all', 'students', 'teachers']);

/** Computed from published_at / expires_at; `all` is accepted only as a list filter. */
export const ANNOUNCEMENT_STATUSES = Object.freeze(['active', 'scheduled', 'expired']);

/** School calendar entries: `holiday` = no classes (attendance cannot be marked), `event` = classes as usual. */
export const CALENDAR_EVENT_TYPES = Object.freeze(['holiday', 'event']);

/** ISO 8601 weekday numbers: 1 = Monday … 7 = Sunday. */
export const DAYS_OF_WEEK = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

export const SORT_ORDERS = Object.freeze(['asc', 'desc']);

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

/** Maximum rows accepted by bulk endpoints (attendance sheet, grade sheet, bulk enrollment). */
export const BULK_MAX_ROWS = 200;

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;
export const STUDENT_NUMBER_REGEX = /^STU-\d{4}-\d{4,}$/;
export const EMPLOYEE_NUMBER_REGEX = /^EMP-\d{4}-\d{4,}$/;
export const SUBJECT_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
export const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Month (1-12) in which the academic year starts. 8 = August, so 2026-10-03 belongs to "2026-2027". */
export const ACADEMIC_YEAR_START_MONTH = 8;

/** The closed error-code catalogue. The API never emits a code outside this list. */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR', // 400
  UNAUTHORIZED: 'UNAUTHORIZED', // 401
  FORBIDDEN: 'FORBIDDEN', // 403
  USER_NOT_REGISTERED: 'USER_NOT_REGISTERED', // 403
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED', // 403
  NOT_FOUND: 'NOT_FOUND', // 404
  CONFLICT: 'CONFLICT', // 409
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT', // 409
  RATE_LIMITED: 'RATE_LIMITED', // 429
  INTERNAL_ERROR: 'INTERNAL_ERROR', // 500
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE', // 503
});

export const API_BASE_PATH = '/api/v1';

/** True when `value` is "YYYY-YYYY" and the second year is the first year + 1. */
export function isConsecutiveAcademicYear(value) {
  if (!ACADEMIC_YEAR_REGEX.test(value)) return false;
  const [first, second] = value.split('-').map(Number);
  return second === first + 1;
}

/** JavaScript `Date#getDay()` (0 = Sunday) → ISO weekday (1 = Monday … 7 = Sunday). */
export function jsDayToIsoDay(jsDay) {
  return ((jsDay + 6) % 7) + 1;
}
