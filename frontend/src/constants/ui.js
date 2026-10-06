/**
 * UI-only constants: labels, badge tones and select options for every shared enum,
 * client error handling tables and small helpers that build option lists.
 *
 * Values that must match the backend (the enums themselves, regexes, error codes) live in
 * `shared.js`; this file only decides how they are displayed. Navigation lives next to the
 * sidebar in components/layout/navConfig.js because it carries icons.
 */
import { currentAcademicYear } from '../utils/date';
import {
  ACTIVITY_AREAS,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_STATUSES,
  ASSESSMENT_TYPES,
  ATTENDANCE_STATUSES,
  CALENDAR_EVENT_TYPES,
  DAYS_OF_WEEK,
  ERROR_CODES,
  GENDERS,
  ROLES,
  TERMS,
} from './shared';

/** `[{ value, label }]` for every value of a shared enum, in the order of the enum. */
const optionsOf = (values, labels) => values.map((value) => ({ value, label: labels[value] }));

export const APP_NAME = 'Skole';

/** An account created this many days ago or less carries a "New" tag in lists. */
export const NEW_ACCOUNT_DAYS = 7;

// ---------------------------------------------------------------------------
// Tones: the status colour families (gray, green, amber, red, blue, violet). Badge turns a tone
// into one of three weights (filled, outline, tinted); alerts, icon chips and timetable slots use
// the soft form below. Both follow the light and dark themes.
// ---------------------------------------------------------------------------

export const TONE_SOFT_CLASSES = Object.freeze({
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
  violet: 'bg-violet-50 text-violet-700',
});

/**
 * The attendance rate below which a student "needs attention" on the dashboards. It mirrors
 * AT_RISK.attendanceRateBelow in backend/src/modules/dashboard/dashboard.service.js (which also sends it in
 * the `atRisk` payload); rings and charts draw their red line here so every view agrees.
 */
export const ATTENDANCE_RATE_LINE = 0.8;

/**
 * Marks: the solid colour of an icon square or chip that tells the areas of the school apart on the
 * dashboards. One colour per area, not per card. `ink` follows the theme (dark on paper, light on
 * graphite); the others are the same in both themes.
 */
export const MARK_CLASSES = Object.freeze({
  oxblood: 'bg-mark-oxblood text-mark-cream ring-1 ring-mark-edge ring-inset', // needs attention
  maroon: 'bg-mark-maroon text-mark-cream ring-1 ring-mark-edge ring-inset', // people: students, teachers, enrollment, announcements
  sage: 'bg-mark-sage text-mark-cream ring-1 ring-mark-edge ring-inset', // attendance, and "all is well"
  cream: 'bg-mark-cream text-mark-oxblood ring-1 ring-mark-edge ring-inset', // teaching and time: classes, subjects, assessments, periods, calendar
});

// ---------------------------------------------------------------------------
// Labels, tones and options per shared enum
// ---------------------------------------------------------------------------

export const ROLE_LABELS = Object.freeze({ admin: 'Administrator', teacher: 'Teacher', student: 'Student' });
export const ROLE_TONES = Object.freeze({ admin: 'violet', teacher: 'blue', student: 'blue' });
export const ROLE_OPTIONS = optionsOf(ROLES, ROLE_LABELS);

/** Where each role lands after signing in; also the prefix of that role's route area. */
export const ROLE_HOME = Object.freeze({ admin: '/admin', teacher: '/teacher', student: '/student' });

export const GENDER_LABELS = Object.freeze({ male: 'Male', female: 'Female', other: 'Other' });
export const GENDER_OPTIONS = optionsOf(GENDERS, GENDER_LABELS);

export const ENROLLMENT_STATUS_LABELS = Object.freeze({
  active: 'Active',
  completed: 'Completed',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
});
export const ENROLLMENT_STATUS_TONES = Object.freeze({
  active: 'green',
  completed: 'blue',
  transferred: 'gray',
  withdrawn: 'amber',
});

export const ATTENDANCE_STATUS_LABELS = Object.freeze({
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
});
export const ATTENDANCE_STATUS_TONES = Object.freeze({
  present: 'green',
  absent: 'red',
  late: 'amber',
  excused: 'blue',
});
export const ATTENDANCE_STATUS_OPTIONS = optionsOf(ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS);

export const ASSESSMENT_TYPE_LABELS = Object.freeze({
  quiz: 'Quiz',
  test: 'Test',
  exam: 'Exam',
  assignment: 'Assignment',
  project: 'Project',
  other: 'Other',
});
export const ASSESSMENT_TYPE_OPTIONS = optionsOf(ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS);

export const TERM_LABELS = Object.freeze({ term1: 'Term 1', term2: 'Term 2', term3: 'Term 3' });
export const TERM_OPTIONS = optionsOf(TERMS, TERM_LABELS);

export const ANNOUNCEMENT_AUDIENCE_LABELS = Object.freeze({
  all: 'Everyone',
  students: 'Students',
  teachers: 'Teachers',
});
export const ANNOUNCEMENT_AUDIENCE_OPTIONS = optionsOf(ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_AUDIENCE_LABELS);

export const ANNOUNCEMENT_STATUS_LABELS = Object.freeze({
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
});
export const ANNOUNCEMENT_STATUS_TONES = Object.freeze({
  active: 'green',
  scheduled: 'blue',
  expired: 'gray',
});
export const ANNOUNCEMENT_STATUS_OPTIONS = optionsOf(ANNOUNCEMENT_STATUSES, ANNOUNCEMENT_STATUS_LABELS);
/** The announcements list filter also accepts `all`. */
export const ANNOUNCEMENT_STATUS_FILTER_OPTIONS = Object.freeze([
  ...ANNOUNCEMENT_STATUS_OPTIONS,
  { value: 'all', label: 'All' },
]);

export const ACTIVITY_AREA_LABELS = Object.freeze({
  accounts: 'Accounts',
  enrollments: 'Enrollments',
  classes: 'Classes and teachers',
  subjects: 'Subjects',
  timetable: 'Schedule',
  attendance: 'Attendance',
  grades: 'Grades',
  announcements: 'Announcements',
  calendar: 'Calendar',
});
export const ACTIVITY_AREA_OPTIONS = optionsOf(ACTIVITY_AREAS, ACTIVITY_AREA_LABELS);

/** Holidays mean no classes (attendance cannot be marked); events are informational. */
export const CALENDAR_EVENT_TYPE_LABELS = Object.freeze({ holiday: 'No classes', event: 'School event' });
export const CALENDAR_EVENT_TYPE_TONES = Object.freeze({ holiday: 'amber', event: 'blue' });
export const CALENDAR_EVENT_TYPE_OPTIONS = optionsOf(CALENDAR_EVENT_TYPES, CALENDAR_EVENT_TYPE_LABELS);

/** ISO weekdays, Monday = 1. */
export const DAY_LABELS = Object.freeze({
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
});
export const DAY_SHORT_LABELS = Object.freeze({
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
});
export const DAY_OPTIONS = DAYS_OF_WEEK.map((day) => ({ value: String(day), label: DAY_LABELS[day] }));

/** Account status filter (users, students, teachers); boolean filters travel as 'true' and 'false'. */
export const USER_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Disabled' },
]);

export const GRADE_LEVELS = Object.freeze(Array.from({ length: 12 }, (_, index) => index + 1));
export const GRADE_LEVEL_OPTIONS = GRADE_LEVELS.map((level) => ({
  value: String(level),
  label: `Grade ${level}`,
}));

/** Page sizes offered by Pagination; the API maximum is PAGINATION.MAX_LIMIT (100). */
export const PAGE_SIZES = Object.freeze([10, 20, 50]);

/**
 * Academic years around the current one, newest first, as select options.
 * @param {number} span how many years to include on each side of the current year
 */
export function academicYearOptions(span = 2) {
  const currentStartYear = Number(currentAcademicYear().slice(0, 4));
  return Array.from({ length: span * 2 + 1 }, (_, index) => {
    const startYear = currentStartYear + span - index;
    const label = `${startYear}-${startYear + 1}`;
    return { value: label, label };
  });
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Notice shown on the sign-in page after the app signs the user out because of these error codes. */
export const SIGN_OUT_MESSAGES = Object.freeze({
  [ERROR_CODES.USER_NOT_REGISTERED]:
    'Your account exists but is not registered in the school system. Contact the administrator.',
  [ERROR_CODES.ACCOUNT_DISABLED]: 'Your account has been disabled. Contact the administrator.',
});

/** Error codes that mean the account itself is no longer usable: the app signs the user out. */
export const FORCE_SIGN_OUT_CODES = Object.freeze(Object.keys(SIGN_OUT_MESSAGES));

/** Notice for every other reason the session cannot continue (expired or revoked token). */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/**
 * Backend unique-key name (`CONFLICT` `details.key`, MySQL `table.index`) mapped to the form field
 * that caused it and the message to show under that field. Used by applyServerErrors; forms whose
 * field is named differently (for example `profile.studentNumber`) pass a `fieldMap`.
 */
export const UNIQUE_KEY_FIELDS = Object.freeze({
  'users.uq_users_email': { field: 'email', message: 'An account with this email already exists' },
  'subjects.uq_subjects_code': { field: 'code', message: 'A subject with this code already exists' },
  'classes.uq_classes_year_name': {
    field: 'name',
    message: 'A class with this name already exists for that academic year',
  },
  'class_subjects.uq_class_subjects_class_subject': {
    field: 'subjectId',
    message: 'This subject is already in the class',
  },
  'students.uq_students_number': { field: 'studentNumber', message: 'This student number is already in use' },
  'teachers.uq_teachers_number': {
    field: 'employeeNumber',
    message: 'This employee number is already in use',
  },
  'schedules.uq_schedules_cs_day_start': {
    field: 'startTime',
    message: 'This subject already has a period starting at this time on that day',
  },
  'assessments.uq_assessments_cs_term_title': {
    field: 'title',
    message: 'An assessment with this title already exists for this term',
  },
});
