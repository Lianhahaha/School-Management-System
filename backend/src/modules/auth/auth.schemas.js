import { z } from 'zod';
import { gradeLevel, name, optionalText, patchOf, phone } from '../../utils/zod/common.js';
import { accountFields, studentDetailFields } from '../../utils/zod/profiles.js';

/**
 * Public registration, which is also an application: the grade applied for and the guardian are required
 * here (an admin-created student may have neither), the previous school is optional. There is deliberately
 * no `role` field: the service forces `student`.
 */
export const registerBody = z.strictObject({
  ...accountFields,
  ...studentDetailFields,
  guardianName: name,
  guardianPhone: phone,
  gradeLevel,
  previousSchool: optionalText(150).optional(),
});

/** Self-service contact fields; address and guardian details are accepted from students only (checked in the service). */
export const updateMeBody = patchOf({
  phone: phone.nullable(),
  address: optionalText(255).nullable(),
  guardianName: name.nullable(),
  guardianPhone: phone.nullable(),
});
