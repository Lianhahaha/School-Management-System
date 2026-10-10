import { z } from 'zod';
import { id, patchOf, shortText } from '../../utils/zod/common.js';

/** Applications are keyed by the student: /admissions/:studentId. */
export const studentIdParams = z.strictObject({ studentId: id });

/** The documents the school office has received (at least one field). */
export const updateChecklistBody = patchOf({
  birthCertificateReceived: z.boolean(),
  reportCardReceived: z.boolean(),
});

/** The reason is shown to the applicant (decline_reason is VARCHAR(255)). */
export const declineBody = z.strictObject({ reason: shortText(255).min(1, { error: 'required' }) });
