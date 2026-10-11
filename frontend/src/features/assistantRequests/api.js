import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/*
 * The sign-ups of student assistants (the school office: an admin or an approved assistant). A request is
 * keyed by the applicant's account id (`userId`) and reads { userId, firstName, lastName, email, phone,
 * isActive, status, declineReason, requestedAt, decidedAt, decidedBy }.
 */

/** params: page, limit, search (name, email), sortBy (requestedAt, decidedAt, lastName), sortOrder, status. */
export const listAssistantRequests = (params) => api.get('/assistant-requests', { params }).then(toPage);

/** From the applicant's next request on, they work in the office. 409 `not_pending` once decided. */
export const approveAssistantRequest = (userId) =>
  api.post(`/assistant-requests/${userId}/approve`).then(toData);

/** With the reason the applicant reads (1-255 characters). 409 `not_pending` once decided. */
export const declineAssistantRequest = (userId, reason) =>
  api.post(`/assistant-requests/${userId}/decline`, { reason }).then(toData);
