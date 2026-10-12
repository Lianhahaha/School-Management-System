/**
 * Shared zod primitives. Every module schema is built from these so formats,
 * limits and enum sources are defined once.
 */
import { z } from 'zod';
import {
  ACADEMIC_YEAR_REGEX,
  BULK_MAX_ROWS,
  DATE_REGEX,
  EMPLOYEE_NUMBER_REGEX,
  HIGHEST_GRADE_LEVEL,
  LRN_REGEX,
  NAME_REGEX,
  PAGINATION,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHONE_REGEX,
  SORT_ORDERS,
  STUDENT_NUMBER_REGEX,
  SUBJECT_CODE_REGEX,
  TIME_REGEX,
  cleanText,
  isConsecutiveAcademicYear,
} from '../../constants/shared.js';
import { todayYmd } from '../dates.js';

/** The largest id there is: every id column is INT UNSIGNED, which MySQL refuses to go past (a 500). */
const MAX_ID = 4_294_967_295;

/**
 * A string of digits becomes its number (path and query values are always text); anything else is left for
 * z.number to judge. Unlike z.coerce, true, [5], '0x10', '1e3' and a missing value stay non-numbers.
 */
const digitsToNumber = (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);

/** A whole number from `min` to `max`, as a JSON number or a string of digits; `error` is its one message. */
const wholeNumber = (min, max, error) =>
  z.preprocess(digitsToNumber, z.number({ error }).int({ error }).min(min, { error }).max(max, { error }));

/** A positive whole-number id: a JSON number, or a string of digits. */
export const id = z.preprocess(
  digitsToNumber,
  z
    .number({ error: 'expected a whole-number id' })
    .int()
    .positive()
    .max(MAX_ID, { error: `ids go up to ${MAX_ID}` }),
);

export const idOrMe = z.union([z.literal('me'), id]);

/**
 * The years a date or date-time may fall in. DATE and DATETIME columns hold 1000 to 9999; stopping one year
 * short leaves room for a day added to a date, or a date-time moved to UTC, so neither leaves the column's
 * range (MySQL refuses those, a 500).
 */
const MIN_YEAR = 1000;
const MAX_YEAR = 9998;
const YEAR_RANGE_ERROR = `the year must be between ${MIN_YEAR} and ${MAX_YEAR}`;
const isYearInRange = (year) => year >= MIN_YEAR && year <= MAX_YEAR;

export const dateStr = z
  .string()
  .regex(DATE_REGEX, { error: 'expected YYYY-MM-DD' })
  .refine(
    (value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    },
    { error: 'not a real calendar date' },
  )
  .refine((value) => isYearInRange(Number(value.slice(0, 4))), { error: YEAR_RANGE_ERROR });

/** A real calendar date strictly before today (school time zone). */
export const pastDate = dateStr.refine((value) => value < todayYmd(), { error: 'must be in the past' });

export const timeStr = z.string().regex(TIME_REGEX, { error: 'expected HH:MM (24-hour)' });

/**
 * An ISO-8601 date-time with a time zone. The year is checked on the instant in UTC, as it is stored:
 * '9998-12-31T23:00:00-05:00' is already the year 9999 there.
 */
export const isoDateTime = z.iso
  .datetime({ offset: true, error: 'expected an ISO-8601 date-time' })
  .refine((value) => isYearInRange(new Date(value).getUTCFullYear()), { error: YEAR_RANGE_ERROR });

/** Trimmed and lower-cased before the format check, so a pasted " Ana@School.ph " is accepted. */
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'invalid email address' }).max(255));

export const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `password must be at least ${PASSWORD_MIN_LENGTH} characters` })
  .max(PASSWORD_MAX_LENGTH);

/** Digits with optional +, spaces, dashes and brackets, and at least 7 digits ("-------" is not a phone). */
export const phone = z
  .string()
  .trim()
  .regex(PHONE_REGEX, { error: 'invalid phone number' })
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, { error: 'invalid phone number' });

/**
 * A name typed all in lower case ("lian harhar", "o'brien") gets a capital at the start of each word
 * ("Lian Harhar", "O'Brien"). Any other casing is kept as typed, so "McDonald" or "dela Cruz" stay right.
 */
export const capitalizeIfLowercase = (value) =>
  value === value.toLowerCase() && value !== value.toUpperCase()
    ? value.replace(/(^|[\s'-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase())
    : value;

/**
 * A person's name (first, last, guardian): letters with the spaces, periods, apostrophes and hyphens names use
 * (NAME_REGEX), so digits, emoji and symbols are refused. Invisible characters are dropped and runs of spaces
 * become one before the check; stored with capitals even when typed in lower case.
 */
export const name = z
  .string()
  .overwrite((value) => cleanText(value))
  .min(1, { error: 'required' })
  .max(100)
  .regex(NAME_REGEX, { error: 'use letters only; spaces, periods, apostrophes and hyphens are allowed' })
  .transform(capitalizeIfLowercase);

/** Free text up to `max` characters, without invisible characters (line breaks kept), trimmed. */
export const shortText = (max) =>
  z
    .string()
    .overwrite((value) => cleanText(value, { keepLines: true }))
    .max(max);

/** Optional free text: trimmed, and blank becomes null, so an empty field is stored as "no value". */
export const optionalText = (max) => shortText(max).transform((value) => value || null);

export const academicYear = z
  .string()
  .regex(ACADEMIC_YEAR_REGEX, { error: 'expected YYYY-YYYY' })
  .refine(isConsecutiveAcademicYear, { error: 'second year must be the first year + 1' });

// At most 20 characters: the columns are VARCHAR(20).
export const studentNumber = z.string().trim().toUpperCase().max(20).regex(STUDENT_NUMBER_REGEX, {
  error: 'expected STU-YYYY-NNNN',
});

/** DepEd Learner Reference Number: exactly 12 digits (the column is CHAR(12)). */
export const lrn = z.string().trim().regex(LRN_REGEX, { error: 'expected the 12 digits of the LRN' });

export const employeeNumber = z.string().trim().toUpperCase().max(20).regex(EMPLOYEE_NUMBER_REGEX, {
  error: 'expected EMP-YYYY-NNNN',
});

export const subjectCode = z.string().trim().toUpperCase().regex(SUBJECT_CODE_REGEX, {
  error: 'expected 2-20 characters: letters, digits or dashes',
});

export const gradeLevel = wholeNumber(
  1,
  HIGHEST_GRADE_LEVEL,
  `expected a grade level from 1 to ${HIGHEST_GRADE_LEVEL}`,
);

export const dayOfWeek = wholeNumber(1, 7, 'expected a day from 1 (Monday) to 7 (Sunday)');

export const score = z.number().min(0).multipleOf(0.01);

/** Query-string boolean: the strings "true" / "false". */
export const boolQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Positive id for route params: z.strictObject({ id }) */
export const idParams = z.strictObject({ id });

export const idOrMeParams = z.strictObject({ id: idOrMe });

/**
 * Builds the strict query schema of a list endpoint: pagination, search,
 * whitelisted sortBy, sortOrder, plus the resource's own filters. Lists without free-text
 * search pass `{ searchable: false }`, so `search` is rejected instead of silently ignored.
 */
export function listQuery(sortable, filters = {}, { searchable = true } = {}) {
  return z.strictObject({
    page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
    ...(searchable && { search: z.string().trim().min(1).max(100).optional() }),
    sortBy: z.enum(sortable).optional(),
    sortOrder: z.enum(SORT_ORDERS).optional(),
    ...filters,
  });
}

/** Strict partial object that must contain at least one field (every PATCH body). */
export function patchOf(shape) {
  return z
    .strictObject(shape)
    .partial()
    .refine((value) => Object.keys(value).length > 0, { error: 'at least one field is required' });
}

/** Array constraint for bulk bodies: 1..BULK_MAX_ROWS rows, unique by `key`. */
export function bulkArray(itemSchema, key) {
  return z
    .array(itemSchema)
    .min(1)
    .max(BULK_MAX_ROWS)
    .refine((rows) => new Set(rows.map((row) => row[key])).size === rows.length, {
      error: `duplicate ${key} in the list`,
    });
}

/** `dateFrom <= dateTo` refinement for range filters. */
export const dateRangeRefinement = [
  (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
  { error: 'dateFrom must not be after dateTo', path: ['dateFrom'] },
];

/** Array of unique positive ids, 1..BULK_MAX_ROWS (bulk enrollment). */
export const idList = z
  .array(id)
  .min(1)
  .max(BULK_MAX_ROWS)
  .refine((ids) => new Set(ids).size === ids.length, { error: 'duplicate ids in the list' });
