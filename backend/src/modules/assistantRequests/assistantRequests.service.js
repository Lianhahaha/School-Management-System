/**
 * Student assistant sign-ups. A student assistant signs up themselves (POST /auth/register with accountType
 * `assistant`): users.service creates the account and a pending request in one transaction. Until the school
 * office (an admin or an approved assistant) approves the request, the account has no access beyond its own
 * /auth/me (middleware/authenticate). A declined applicant keeps the account, reads the reason on /auth/me and
 * stays locked out; an admin may delete the unused account. An assistant without a request (created before
 * assistants signed up themselves) counts as approved.
 */
import { ApiError } from '../../utils/ApiError.js';
import { personRef } from '../../utils/shapes.js';
import { assertOffice } from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyUser, resolveAssistantSignup } from '../notifications/notifications.service.js';
import * as repo from './assistantRequests.repository.js';

const toRequestShape = (row) => ({
  userId: row.userId,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
  phone: row.phone,
  isActive: row.isActive,
  status: row.status,
  declineReason: row.declineReason,
  requestedAt: row.requestedAt,
  decidedAt: row.decidedAt,
  decidedBy: personRef(row.decidedBy, row.decidedByFirstName, row.decidedByLastName),
});

/** Inserts the pending request of a new student assistant. Runs inside the caller's transaction (users.service). */
export const createRequest = (userId, conn) => repo.insertRequest(userId, conn);

/** Deletes the request of an account being deleted. Runs inside its transaction (users.service). */
export const deleteForUser = (userId, conn) => repo.deleteByUserId(userId, conn);

/** `{ status, declineReason, requestedAt }` of an assistant's own request (the account shape), or null. */
export async function requestOf(userId) {
  const row = await repo.findRequest(userId);
  return row ? { status: row.status, declineReason: row.declineReason, requestedAt: row.requestedAt } : null;
}

/** GET /assistant-requests: the school office. */
export async function listRequests(user, listQuery) {
  assertOffice(user);
  const { rows, meta } = await repo.listRequests(listQuery);
  return { data: rows.map(toRequestShape), meta };
}

/** Applies `decision` to a pending request: 404 without a request, 409 `not_pending` once it is decided. */
async function decide(user, userId, decision) {
  assertOffice(user);
  if (!(await repo.decidePending(userId, { ...decision, decidedBy: user.id }))) {
    const { status } = ApiError.assertFound(await repo.findRequest(userId), 'assistant request', userId);
    throw ApiError.conflict(`only a pending request can be approved or declined; this one is ${status}`, {
      reason: 'not_pending',
      status,
    });
  }
  return toRequestShape(await repo.findRequest(userId));
}

/** The office's sign-up notes about the request are done, and the applicant is told. */
async function announce(request, note) {
  await resolveAssistantSignup(request.userId);
  await notifyUser(request.userId, { type: 'signup', ...note });
}

/** POST /assistant-requests/:userId/approve: from the next request on, the assistant works in the office. */
export async function approve(user, userId) {
  const request = await decide(user, userId, { status: 'approved' });
  await record({
    action: 'assistant_request.approve',
    entityId: userId,
    summary: `Approved the student assistant request of ${nameOf(request)} (${request.email})`,
    details: { email: request.email },
  });
  await announce(request, {
    title: 'Your student assistant request was approved',
    body: 'You can now work in the school office pages.',
    link: '/admin',
  });
  return request;
}

/** POST /assistant-requests/:userId/decline: the applicant reads the reason on /auth/me and stays locked out. */
export async function decline(user, userId, { reason }) {
  const request = await decide(user, userId, { status: 'declined', reason });
  await record({
    action: 'assistant_request.decline',
    entityId: userId,
    summary: `Declined the student assistant request of ${nameOf(request)} (${request.email})`,
    details: { email: request.email, reason },
  });
  await announce(request, { title: 'Your student assistant request was declined', body: reason });
  return request;
}
