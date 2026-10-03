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
  PAGINATION,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHONE_REGEX,
  SORT_ORDERS,
  STUDENT_NUMBER_REGEX,
  SUBJECT_CODE_REGEX,
  TIME_REGEX,
  isConsecutiveAcademicYear,
} from '../../constants/shared.js';
import { todayYmd } from '../dates.js';

export const id = z.coerce.number().int().positive();

export const idOrMe = z.union([z.literal('me'), id]);

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
  );

/** A real calendar date strictly before today (school time zone). */
export const pastDate = dateStr.refine((value) => value < todayYmd(), { error: 'must be in the past' });

export const timeStr = z.string().regex(TIME_REGEX, { error: 'expected HH:MM (24-hour)' });

export const isoDateTime = z.iso.datetime({ offset: true, error: 'expected an ISO-8601 date-time' });

export const email = z.email({ error: 'invalid email address' }).trim().toLowerCase().max(255);

export const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `password must be at least ${PASSWORD_MIN_LENGTH} characters` })
  .max(PASSWORD_MAX_LENGTH);

export const phone = z.string().trim().regex(PHONE_REGEX, { error: 'invalid phone number' });

export const name = z.string().trim().min(1, { error: 'required' }).max(100);

export const shortText = (max) => z.string().trim().max(max);

export const academicYear = z
  .string()
  .regex(ACADEMIC_YEAR_REGEX, { error: 'expected YYYY-YYYY' })
  .refine(isConsecutiveAcademicYear, { error: 'second year must be the first year + 1' });

export const studentNumber = z.string().trim().toUpperCase().regex(STUDENT_NUMBER_REGEX, {
  error: 'expected STU-YYYY-NNNN',
});

export const employeeNumber = z.string().trim().toUpperCase().regex(EMPLOYEE_NUMBER_REGEX, {
  error: 'expected EMP-YYYY-NNNN',
});

export const subjectCode = z.string().trim().toUpperCase().regex(SUBJECT_CODE_REGEX, {
  error: 'expected 2-20 characters: letters, digits or dashes',
});

export const gradeLevel = z.coerce.number().int().min(1).max(12);

export const dayOfWeek = z.coerce.number().int().min(1).max(7);

export const score = z.number().min(0).multipleOf(0.01);

/** Query-string boolean: the strings "true" / "false". */
export const boolQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Positive id for route params: z.strictObject({ id }) */
export const idParams = z.strictObject({ id });

export const idOrMeParams = z.strictObject({ id: idOrMe });

/**
 * Builds the strict query schema of a list endpoint: pagination, search,
 * whitelisted sortBy, sortOrder, plus the resource's own filters.
 */
export function listQuery(sortable, filters = {}) {
  return z.strictObject({
    page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
    search: z.string().trim().min(1).max(100).optional(),
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
