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
 * no framework code. Values only, plus the tiny helpers at the bottom.
 */

/**
 * `assistant` is a student assistant: everyday office work for the admin (enrollment, student records,
 * classes, the timetable, announcements). What cannot be undone, changes grades or manages accounts other
 * than students' stays with the admin.
 */
export const ROLES = Object.freeze(['admin', 'teacher', 'student', 'assistant']);

export const GENDERS = Object.freeze(['male', 'female', 'other']);

export const ENROLLMENT_STATUSES = Object.freeze(['active', 'completed', 'transferred', 'withdrawn']);

/**
 * Where a self-registered student's application stands: pending (signed up, no class yet; the school office
 * ticks off the documents) or admitted (enrolled in a class, usually one the student picked). Nobody declines
 * an application any more: declined only remains on applications declined before students picked their class.
 */
export const ADMISSION_STATUSES = Object.freeze(['pending', 'admitted', 'declined']);

/**
 * Where the sign-up of a student assistant stands: pending (no office access until the school office approves
 * it), approved, or declined (with a reason the applicant reads). An assistant without a request (created before
 * assistants signed up themselves) counts as approved.
 */
export const ASSISTANT_REQUEST_STATUSES = Object.freeze(['pending', 'approved', 'declined']);

export const ATTENDANCE_STATUSES = Object.freeze(['present', 'absent', 'late', 'excused']);

export const ASSESSMENT_TYPES = Object.freeze(['quiz', 'test', 'exam', 'assignment', 'project', 'other']);

/**
 * K-12 grading (DepEd Order 8, s. 2015). A subject in one of these groups is graded by three components,
 * each with the group's weight in percent; the weighted result (initial grade) is transmuted to 60-100.
 * languages, math_science and mapeh are the groups of Grades 1-10 (the order's Table 4); the shs_ groups are
 * Senior High's (Grades 11-12, Table 5): the core subjects (shs_core), the academic track's other subjects
 * (shs_academic), the academic track's work immersion, research, business enterprise simulation, exhibit or
 * performance (shs_immersion), and every subject of the TVL, sports and arts and design tracks, their work
 * immersion included (shs_tvl).
 */
export const GRADING_GROUPS = Object.freeze([
  'languages',
  'math_science',
  'mapeh',
  'shs_core',
  'shs_academic',
  'shs_immersion',
  'shs_tvl',
]);

/**
 * The Senior High groups of GRADING_GROUPS. DepEd weighs the components of Grades 11-12 differently from
 * those of Grades 1-10, so a subject in one of these groups is taught in Grades 11-12 only and a subject in
 * another group in Grades 1-10 only; a subject on points or on its own weights may be taught in any grade.
 */
export const SENIOR_HIGH_GRADING_GROUPS = Object.freeze([
  'shs_core',
  'shs_academic',
  'shs_immersion',
  'shs_tvl',
]);

export const GRADING_COMPONENTS = Object.freeze(['written', 'performance', 'quarterly']);

export const COMPONENT_WEIGHTS = Object.freeze({
  languages: Object.freeze({ written: 30, performance: 50, quarterly: 20 }),
  math_science: Object.freeze({ written: 40, performance: 40, quarterly: 20 }),
  mapeh: Object.freeze({ written: 20, performance: 60, quarterly: 20 }),
  shs_core: Object.freeze({ written: 25, performance: 50, quarterly: 25 }),
  shs_academic: Object.freeze({ written: 25, performance: 45, quarterly: 30 }),
  shs_immersion: Object.freeze({ written: 35, performance: 40, quarterly: 25 }),
  shs_tvl: Object.freeze({ written: 20, performance: 60, quarterly: 20 }),
});

/** The K-12 component each assessment type counts towards. */
export const COMPONENT_OF_TYPE = Object.freeze({
  quiz: 'written',
  test: 'written',
  assignment: 'written',
  project: 'performance',
  other: 'performance',
  exam: 'quarterly',
});

/** The lowest passing grade (the transmuted 60-100 scale; also the at-risk line). */
export const PASSING_GRADE = 75;

/**
 * Where a student without a class stands for next year (DepEd promotion rules, GET /enrollments/next-class):
 * enrolled (has a class), needs_placement (no finished year to judge: an admin places them), promoted (every
 * subject passed: next grade level), remedial (1 or 2 subjects failed: an admin places them after remedial
 * classes), retained (3 or more failed: same grade level again), finished (passed the highest grade level),
 * new (signed up and never placed: a section of the grade applied for, this school year).
 */
export const NEXT_CLASS_STANDINGS = Object.freeze([
  'enrolled',
  'needs_placement',
  'promoted',
  'remedial',
  'retained',
  'finished',
  'new',
]);

/** Failed subjects up to this many mean remedial classes; more mean repeating the grade level. */
export const REMEDIAL_MAX_FAILED = 2;

/** The highest grade level (classes run from 1 to 12). */
export const HIGHEST_GRADE_LEVEL = 12;

/** The first grade level of Senior High School, which runs to HIGHEST_GRADE_LEVEL (Grades 11 and 12). */
export const SENIOR_HIGH_FIRST_GRADE = 11;

/**
 * The quarters of a semester: term1 = 1st Quarter … term4 = 4th Quarter. Every semester has its own four, so a
 * grading period is a (semester, quarter) pair, eight to a school year. Each quarter is graded on its own; a
 * semester's grade of a subject is the average of its quarterly grades.
 */
export const TERMS = Object.freeze(['term1', 'term2', 'term3', 'term4']);

/**
 * The two semesters of a school year (no summer term): sem1 = 1st Semester, sem2 = 2nd Semester. The school
 * year's grade of a subject is the average of its semesters' grades.
 */
export const SEMESTERS = Object.freeze(['sem1', 'sem2']);

/**
 * How many months the 1st Semester lasts, counted from ACADEMIC_YEAR_START_MONTH: with a start in August, August
 * to December are the 1st Semester and January to July the 2nd.
 */
export const FIRST_SEMESTER_MONTHS = 5;

export const ANNOUNCEMENT_AUDIENCES = Object.freeze(['all', 'students', 'teachers']);

/** Computed from published_at / expires_at; `all` is accepted only as a list filter. */
export const ANNOUNCEMENT_STATUSES = Object.freeze(['active', 'scheduled', 'expired']);

/** School calendar entries: `holiday` = no classes (attendance cannot be marked), `event` = classes as usual. */
export const CALENDAR_EVENT_TYPES = Object.freeze(['holiday', 'event']);

/** What an in-app notification is about (its icon): a grade, an absence, a class, a lesson to teach, a sign-up. */
export const NOTIFICATION_TYPES = Object.freeze(['grade', 'attendance', 'enrollment', 'teaching', 'signup']);

/** Parts of the school the activity log groups changes by (its filter). */
export const ACTIVITY_AREAS = Object.freeze([
  'accounts',
  'enrollments',
  'classes',
  'subjects',
  'timetable',
  'attendance',
  'grades',
  'announcements',
  'calendar',
]);

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

/**
 * Seats of a class for students who enroll themselves (the school office may enroll beyond them): CLASS_SEATS,
 * and CLASS_EXTRA_SEATS more in every class of a grade level and school year once each of them has CLASS_SEATS.
 */
export const CLASS_SEATS = 35;
export const CLASS_EXTRA_SEATS = 10;

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;
export const STUDENT_NUMBER_REGEX = /^STU-\d{4}-\d{4,}$/;
export const EMPLOYEE_NUMBER_REGEX = /^EMP-\d{4}-\d{4,}$/;
/** DepEd Learner Reference Number: 12 digits, issued once per learner. */
export const LRN_REGEX = /^\d{12}$/;
export const SUBJECT_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
export const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
/**
 * A person's name: letters of any language with their accents, and the spaces, periods, apostrophes and
 * hyphens names use ("Ma. Clara", "O'Brien", "Dela Cruz-Niño"), starting with a letter. No digits, emoji or
 * other symbols.
 */
export const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Month (1-12) in which the academic year starts. 8 = August, so 2026-10-03 belongs to "2026-2027". */
export const ACADEMIC_YEAR_START_MONTH = 8;

/**
 * The date of the Privacy Notice's current wording. Change it whenever the notice changes in substance:
 * sign-up records which version each person agreed to (and refuses any other), so the school can show
 * what notice they were given.
 */
export const PRIVACY_NOTICE_VERSION = '2026-10-13';

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

/**
 * Typed text without what nobody can see: control characters and format characters such as zero-width spaces
 * or text-direction overrides, often pasted in by accident. One-line text also turns line breaks into spaces
 * and every run of spaces into one; with `keepLines` line breaks stay (\r\n becomes \n). Tabs become spaces.
 * Trimmed either way.
 * @param {string} value
 * @param {{ keepLines?: boolean }} [options]
 */
export function cleanText(value, { keepLines = false } = {}) {
  const lines = value.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  const visible = lines.replace(/\p{Cf}/gu, '');
  if (keepLines) return visible.replace(/[^\P{Cc}\n]/gu, '').trim();
  const oneLine = visible.replace(/\p{Cc}/gu, ' ');
  return oneLine.replace(/\s+/g, ' ').trim();
}
