import { z } from 'zod';
import { name, patchOf, phone, shortText } from '../../utils/zod/common.js';
import { accountFields, studentDetailFields } from '../../utils/zod/profiles.js';

/** Public registration. There is deliberately no `role` field: the service forces `student`. */
export const registerBody = z.strictObject({ ...accountFields, ...studentDetailFields });

/** Self-service contact fields; address and guardian details are accepted from students only (checked in the service). */
export const updateMeBody = patchOf({
  phone: phone.nullable(),
  address: shortText(255).nullable(),
  guardianName: name.nullable(),
  guardianPhone: phone.nullable(),
});
