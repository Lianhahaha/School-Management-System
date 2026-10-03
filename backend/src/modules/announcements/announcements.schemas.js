import { z } from 'zod';
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_STATUSES } from '../../constants/shared.js';
import { id, idOrMe, idParams, isoDateTime, listQuery, patchOf, shortText } from '../../utils/zod/common.js';
import { ANNOUNCEMENT_SORT_MAP } from './announcements.repository.js';

const title = shortText(150).min(1, { error: 'required' });
const body = shortText(5000).min(1, { error: 'required' });
const audience = z.enum(ANNOUNCEMENT_AUDIENCES);

export const listAnnouncementsQuery = listQuery(Object.keys(ANNOUNCEMENT_SORT_MAP), {
  audience: audience.optional(),
  classId: id.optional(),
  authorId: idOrMe.optional(),
  status: z.enum([...ANNOUNCEMENT_STATUSES, 'all']).optional(),
});

export const createAnnouncementBody = z.strictObject({
  title,
  body,
  audience,
  classId: id.nullable().optional(),
  publishedAt: isoDateTime.optional(),
  expiresAt: isoDateTime.nullable().optional(),
});

/** The expiresAt > publishedAt rule is checked in the service against the merged values. */
export const updateAnnouncementBody = patchOf({
  title,
  body,
  audience,
  classId: id.nullable(),
  publishedAt: isoDateTime,
  expiresAt: isoDateTime.nullable(),
});

export { idParams };
