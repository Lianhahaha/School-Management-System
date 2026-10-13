import { z } from 'zod';
import { PRIVACY_NOTICE_VERSION } from '../../constants/shared.js';
import { gradeLevel, name, optionalText, patchOf, phone } from '../../utils/zod/common.js';
import { accountFields, studentDetailFields } from '../../utils/zod/profiles.js';

/**
 * Consent is a clear act (RA 10173): the form sends the version of the Privacy Notice the person ticked to
 * agree to. Missing, or an older version (a page loaded before the notice changed), is a 400.
 */
const privacyNoticeVersion = z.literal(PRIVACY_NOTICE_VERSION, {
  error: 'agree to the current Privacy Notice; reload the page if it changed',
});

/**
 * Public registration, by `accountType` (default `student`). There is deliberately no `role` field: the
 * service derives it from the account type. Both kinds agree to the current Privacy Notice.
 *
 *   student    also an application: the grade applied for and the guardian are required here (an
 *              admin-created student may have neither), the previous school is optional.
 *   assistant  a student assistant: the account fields only (no student details, no application); the
 *              account waits for the school office to approve it.
 */
export const registerBody = z.discriminatedUnion(
  'accountType',
  [
    z.strictObject({
      accountType: z.literal('student').default('student'),
      ...accountFields,
      ...studentDetailFields,
      guardianName: name,
      guardianPhone: phone,
      gradeLevel,
      previousSchool: optionalText(150).optional(),
      privacyNoticeVersion,
    }),
    z.strictObject({ accountType: z.literal('assistant'), ...accountFields, privacyNoticeVersion }),
  ],
  {
    error: (issue) =>
      issue.code === 'invalid_union' ? 'accountType must be one of: student, assistant' : undefined,
  },
);

/** Self-service contact fields; address and guardian details are accepted from students only (checked in the service). */
export const updateMeBody = patchOf({
  phone: phone.nullable(),
  address: optionalText(255).nullable(),
  guardianName: name.nullable(),
  guardianPhone: phone.nullable(),
});
