import { z } from 'zod';
import { id, patchOf } from '../../utils/zod/common.js';

/** Applications are keyed by the student: /admissions/:studentId. */
export const studentIdParams = z.strictObject({ studentId: id });

/** The documents the school office has received (at least one field). */
export const updateChecklistBody = patchOf({
  birthCertificateReceived: z.boolean(),
  reportCardReceived: z.boolean(),
});
