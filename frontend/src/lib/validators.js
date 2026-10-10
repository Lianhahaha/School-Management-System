/**
 * Reusable zod pieces for forms. The regexes, lengths and the academic-year rule come from
 * constants/shared.js, so a value the form accepts is a value the backend accepts.
 * Error messages are full sentences without echoing the field name (the label is right there).
 *
 * Optional form inputs are empty strings, never undefined. Wrap them so the submitted value
 * matches what the endpoint wants:
 *   optionalField(schema)  '' -> undefined (key left out of the JSON)   for optional fields of POST bodies
 *   nullableField(schema)  '' -> null (clears the stored value)         for nullable fields of PATCH bodies
 */
import { z } from 'zod';
import {
  ACADEMIC_YEAR_REGEX,
  DATE_REGEX,
  EMPLOYEE_NUMBER_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHONE_REGEX,
  STUDENT_NUMBER_REGEX,
  SUBJECT_CODE_REGEX,
  TIME_REGEX,
  isConsecutiveAcademicYear,
} from '../constants/shared';
import { todayYmd } from '../utils/date';

/** '2025-02-30' matches DATE_REGEX but is not a calendar date. */
function isCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email' }).max(255, 'Use 255 characters or fewer'));

export const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** Required person name (first name, last name, guardian name). */
export const name = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(100, 'Use 100 characters or fewer')
  .refine((value) => /\p{L}/u.test(value), 'Use letters in a name');

/** Same rule as the API: digits with + ( ) - and spaces, at least 7 digits. */
export const phone = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Enter a valid phone number')
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, 'Enter a valid phone number');

export const dateYMD = z
  .string()
  .regex(DATE_REGEX, { error: 'Enter a valid date', abort: true })
  .refine(isCalendarDate, 'Enter a valid date');

/** A real date strictly before today (a date of birth). */
export const pastDateYMD = dateYMD.refine((value) => value < todayYmd(), 'Date must be in the past');

export const timeHM = z.string().regex(TIME_REGEX, 'Enter a time as HH:MM (24-hour)');

export const academicYear = z
  .string()
  .regex(ACADEMIC_YEAR_REGEX, { error: 'Use the format 2026-2027', abort: true })
  .refine(isConsecutiveAcademicYear, 'The second year must follow the first, for example 2026-2027');

export const studentNumber = z
  .string()
  .trim()
  .toUpperCase()
  .max(20, 'Use 20 characters or fewer')
  .regex(STUDENT_NUMBER_REGEX, 'Use the format STU-2026-0001');

export const employeeNumber = z
  .string()
  .trim()
  .toUpperCase()
  .max(20, 'Use 20 characters or fewer')
  .regex(EMPLOYEE_NUMBER_REGEX, 'Use the format EMP-2026-0001');

export const subjectCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SUBJECT_CODE_REGEX, 'Use 2 to 20 letters, digits or dashes');

/** A positive whole number from a text or select input (ids, counts). */
export const positiveInt = z.coerce
  .number({ error: 'Enter a whole number greater than 0' })
  .int('Enter a whole number greater than 0')
  .positive('Enter a whole number greater than 0');

/**
 * A required choice from a select of ids: an empty selection reads `message` ("Choose a class").
 * The cast tells TypeScript that the piped value is the string: Zod types a coerced number's input as
 * unknown, and .pipe() after a string schema wants a schema that reads a string (z.coerce.number<string>()).
 */
export const requiredId = (message) =>
  z
    .string()
    .min(1, message)
    .pipe(/** @type {z.ZodCoercedNumber<string>} */ (positiveInt));

/**
 * A score with at most two decimals. A blank input coerces to 0, so callers must drop blank
 * rows before validating (a blank score means "not graded yet").
 */
export const score = z.coerce
  .number({ error: 'Enter a number' })
  .min(0, 'A score cannot be negative')
  .multipleOf(0.01, 'Use at most two decimals');

/** Empty input -> `undefined`; anything else must satisfy `schema`. */
export const optionalField = (schema) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(schema.optional());

/** Empty input -> `null`; anything else must satisfy `schema`. */
export const nullableField = (schema) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(schema.nullable());
