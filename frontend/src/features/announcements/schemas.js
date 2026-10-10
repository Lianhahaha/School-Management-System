import { z } from 'zod';
import { ANNOUNCEMENT_AUDIENCES } from '../../constants/shared';
import { nullableField, optionalField, positiveInt, requiredId } from '../../lib/validators';
import { fromIsoToDatetimeLocal, toIsoWithOffset } from '../../utils/date';

const DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `<input type="datetime-local">` value in, ISO-8601 timestamp with the viewer's UTC offset out. */
const dateTime = z
  .string()
  .regex(DATETIME_LOCAL_REGEX, 'Enter a valid date and time')
  .transform(toIsoWithOffset);

const commonFields = {
  title: z.string().trim().min(1, 'This field is required').max(150, 'Use 150 characters or fewer'),
  body: z.string().trim().min(1, 'This field is required').max(5000, 'Use 5000 characters or fewer'),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES, { error: 'Choose an audience' }),
};

/** A teacher must pick a class; an admin may leave it blank for a school-wide announcement. */
const classField = (blank, isClassRequired) =>
  isClassRequired ? requiredId('Choose a class') : blank(positiveInt);

/**
 * The check and the error, spread into `.refine()`.
 * @type {[(announcement: { publishedAt?: string | null, expiresAt?: string | null }) => boolean,
 *   { error: string, path: string[] }]}
 */
const expiresAfterPublished = [
  // A blank publish time means "now", so the expiry must still be in the future.
  (announcement) =>
    !announcement.expiresAt ||
    new Date(announcement.expiresAt) > new Date(announcement.publishedAt ?? Date.now()),
  { error: 'Expiry must be after the publish time', path: ['expiresAt'] },
];

/**
 * POST /announcements. A blank publish time means "now" and is left out; so is a blank expiry.
 * @param {{ isClassRequired?: boolean }} [options] true for teachers
 */
export const createAnnouncementSchema = ({ isClassRequired = false } = {}) =>
  z
    .object({
      ...commonFields,
      classId: classField(optionalField, isClassRequired),
      publishedAt: optionalField(dateTime),
      expiresAt: optionalField(dateTime),
    })
    .refine(...expiresAfterPublished);

/**
 * PATCH /announcements/:id from the edit form: the publish time is always filled, a blank expiry
 * (or class, for an admin) is sent as null.
 * @param {{ isClassRequired?: boolean }} [options] true for teachers
 */
export const updateAnnouncementSchema = ({ isClassRequired = false } = {}) =>
  z
    .object({
      ...commonFields,
      classId: classField(nullableField, isClassRequired),
      publishedAt: dateTime,
      expiresAt: nullableField(dateTime),
    })
    .refine(...expiresAfterPublished);

/** Form values; call without an argument for the create form. */
export const announcementDefaults = (announcement) => ({
  title: announcement?.title ?? '',
  body: announcement?.body ?? '',
  audience: announcement?.audience ?? 'all',
  classId: announcement?.classId ? String(announcement.classId) : '',
  publishedAt: fromIsoToDatetimeLocal(announcement?.publishedAt),
  expiresAt: fromIsoToDatetimeLocal(announcement?.expiresAt),
});
