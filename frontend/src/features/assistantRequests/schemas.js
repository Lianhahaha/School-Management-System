import { z } from 'zod';

/** Declining a student assistant's request: the reason is shown to the applicant (the API takes up to 255). */
export const declineRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Tell the applicant why').max(255, 'Use 255 characters or fewer'),
});

export const declineRequestDefaults = { reason: '' };
