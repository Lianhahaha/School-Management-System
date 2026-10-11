import { z } from 'zod';
import { ASSISTANT_REQUEST_STATUSES } from '../../constants/shared.js';
import { id, listQuery, shortText } from '../../utils/zod/common.js';
import { ASSISTANT_REQUEST_SORT_MAP } from './assistantRequests.repository.js';

export const listAssistantRequestsQuery = listQuery(Object.keys(ASSISTANT_REQUEST_SORT_MAP), {
  status: z.enum(ASSISTANT_REQUEST_STATUSES).optional(),
});

/** Requests are keyed by the applicant's account: /assistant-requests/:userId. */
export const userIdParams = z.strictObject({ userId: id });

/** The reason is shown to the applicant (decline_reason is VARCHAR(255)). */
export const declineBody = z.strictObject({ reason: shortText(255).min(1, { error: 'required' }) });
