import { z } from 'zod';
import { ROLES } from '../../constants/shared.js';
import { boolQuery, idParams, listQuery, name, patchOf, phone } from '../../utils/zod/common.js';
import { accountFields, studentProfileInput, teacherProfileInput } from '../../utils/zod/profiles.js';
import { USER_SORT_MAP } from './users.repository.js';

export const listUsersQuery = listQuery(Object.keys(USER_SORT_MAP), {
  role: z.enum(ROLES).optional(),
  isActive: boolQuery.optional(),
});

/** `profile` is required to be an object for students and teachers (may be empty) and forbidden for admins. */
export const createUserBody = z.discriminatedUnion('role', [
  z.strictObject({ role: z.literal('student'), ...accountFields, profile: studentProfileInput.default({}) }),
  z.strictObject({ role: z.literal('teacher'), ...accountFields, profile: teacherProfileInput.default({}) }),
  z.strictObject({ role: z.literal('admin'), ...accountFields }),
]);

/** Email and role are immutable after creation; an account created by mistake is deleted while it has no records. */
export const updateUserBody = patchOf({ firstName: name, lastName: name, phone: phone.nullable() });

export const statusBody = z.strictObject({ isActive: z.boolean() });

export { idParams };
