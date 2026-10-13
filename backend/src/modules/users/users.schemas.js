import { z } from 'zod';
import { ROLES } from '../../constants/shared.js';
import { boolQuery, idParams, listQuery, name, patchOf, phone } from '../../utils/zod/common.js';
import { accountFields, studentProfileInput, teacherProfileInput } from '../../utils/zod/profiles.js';
import { USER_SORT_MAP } from './users.repository.js';

export const listUsersQuery = listQuery(Object.keys(USER_SORT_MAP), {
  role: z.enum(ROLES).optional(),
  isActive: boolQuery.optional(),
});

/** Why POST /users refuses the role `assistant`, for everyone (users.service checks it again). */
export const ASSISTANT_SIGNUP_ONLY =
  'student assistants sign up themselves (POST /auth/register) and the school office approves them; they cannot be created here';

/**
 * `profile` is required to be an object for students and teachers (may be empty) and forbidden for admins.
 * Which roles the caller may create is the service's rule (a student assistant: students and teachers). There is no
 * `assistant` variant: student assistants only come from sign-up.
 */
export const createUserBody = z.discriminatedUnion(
  'role',
  [
    z.strictObject({
      role: z.literal('student'),
      ...accountFields,
      profile: studentProfileInput.default({}),
    }),
    z.strictObject({
      role: z.literal('teacher'),
      ...accountFields,
      profile: teacherProfileInput.default({}),
    }),
    z.strictObject({ role: z.literal('admin'), ...accountFields }),
  ],
  {
    error: (issue) => {
      if (issue.code !== 'invalid_union') return undefined;
      return issue.input?.role === 'assistant'
        ? ASSISTANT_SIGNUP_ONLY
        : 'role must be one of: student, teacher, admin';
    },
  },
);

/** Email and role are immutable after creation; an account created by mistake is deleted while it has no records. */
export const updateUserBody = patchOf({ firstName: name, lastName: name, phone: phone.nullable() });

export const statusBody = z.strictObject({ isActive: z.boolean() });

export { idParams };
