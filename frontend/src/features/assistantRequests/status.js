/** The request statuses that keep a student assistant out of the school office. */
const AWAITING_STATUSES = Object.freeze(['pending', 'declined']);

/**
 * True for a student assistant whose sign-up the school office has not approved: still pending, or declined.
 * Such an account may only call GET and PATCH /auth/me (every other request answers 403
 * `assistant_not_approved`), so the app shows it the waiting screen and nothing that fetches. An assistant
 * whose `assistantRequest` is null was created before assistants signed up themselves, and counts as approved.
 *
 * @param {{ role: string, assistantRequest?: { status: string } | null } | null | undefined} me the GET /auth/me account
 * @returns {boolean}
 */
export function isAwaitingApproval(me) {
  return me?.role === 'assistant' && AWAITING_STATUSES.includes(me.assistantRequest?.status);
}
