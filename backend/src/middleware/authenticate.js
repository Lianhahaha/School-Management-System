/**
 * authenticate — turns `Authorization: Bearer <Firebase ID token>` into req.user.
 *
 *   1. missing / malformed header            -> 401 UNAUTHORIZED
 *   2. token rejected by Firebase            -> 401 UNAUTHORIZED (details.reason = Firebase code)
 *   3. token could not be checked            -> 503 SERVICE_UNAVAILABLE (details.component = auth),
 *      e.g. Google's signing keys cannot be downloaded; the session stays valid
 *   4. no users row for the Firebase uid     -> 403 USER_NOT_REGISTERED
 *   5. users.is_active = 0                   -> 403 ACCOUNT_DISABLED
 *   6. a student assistant whose sign-up is pending or declined
 *                                            -> 403 FORBIDDEN (details.reason = assistant_not_approved),
 *      except on the routes that use authenticateOwnAccount (GET and PATCH /auth/me)
 *   7. req.user = { id, firebaseUid, email, firstName, lastName, role, studentId, teacherId, activeClassId,
 *      assistantRequestStatus }, also kept as the request context's user (utils/requestContext) for the
 *      activity log
 *
 * The MySQL row is loaded on every request on purpose: a deactivated user's
 * still-valid token must stop working immediately, and so must an assistant's whose request was declined.
 */
import { firebase } from '../config/firebase.js';
import { isAwaitingApproval } from '../modules/access/access.service.js';
import { findAuthContextByFirebaseUid } from '../modules/users/users.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { tokenVerificationError } from '../utils/firebaseErrorMap.js';
import { runWithContext } from '../utils/requestContext.js';

/** The 403 of a student assistant the school office has not approved (yet), or undefined. */
function notApproved(user) {
  if (!isAwaitingApproval(user)) return undefined;
  return ApiError.forbidden(
    'assistant_not_approved',
    user.assistantRequestStatus === 'declined'
      ? 'your request to be a student assistant was declined'
      : 'your request to be a student assistant is waiting for the school office to approve it',
  );
}

function authenticator({ allowAwaitingApproval }) {
  const gate = (user) => (allowAwaitingApproval ? undefined : notApproved(user));
  return async (req, _res, next) => {
    // A request that falls through one authenticated mount into another (/assessments/:id/grades, then
    // /assessments) is checked once; the request context set below is still active.
    if (req.user) return next(gate(req.user));
    // The scheme name is case-insensitive (RFC 9110); exactly one token must follow it.
    const token = /^Bearer\s+(\S+)\s*$/i.exec(req.get('Authorization') ?? '')?.[1];
    if (!token) return next(ApiError.unauthorized('missing bearer token', 'missing_token'));

    let decoded;
    try {
      decoded = await firebase.verifyIdToken(token);
    } catch (error) {
      return next(tokenVerificationError(error));
    }

    const user = await findAuthContextByFirebaseUid(decoded.uid);
    if (!user) return next(ApiError.notRegistered(decoded.uid));
    if (!user.isActive) return next(ApiError.accountDisabled());

    req.user = user;
    runWithContext({ user }, () => next(gate(user)));
  };
}

/** Every secured route. A student assistant whose sign-up is pending or declined is refused here. */
export const authenticate = authenticator({ allowAwaitingApproval: false });

/**
 * The caller's own account only (GET and PATCH /auth/me): a student assistant whose sign-up is pending or
 * declined gets through, to read where the request stands and keep their contact details right.
 */
export const authenticateOwnAccount = authenticator({ allowAwaitingApproval: true });
