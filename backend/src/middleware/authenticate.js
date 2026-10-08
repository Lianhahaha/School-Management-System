/**
 * authenticate — turns `Authorization: Bearer <Firebase ID token>` into req.user.
 *
 *   1. missing / malformed header            -> 401 UNAUTHORIZED
 *   2. token rejected by Firebase            -> 401 UNAUTHORIZED (details.reason = Firebase code)
 *   3. token could not be checked            -> 503 SERVICE_UNAVAILABLE (details.component = auth),
 *      e.g. Google's signing keys cannot be downloaded; the session stays valid
 *   4. no users row for the Firebase uid     -> 403 USER_NOT_REGISTERED
 *   5. users.is_active = 0                   -> 403 ACCOUNT_DISABLED
 *   6. req.user = { id, firebaseUid, email, firstName, lastName, role, studentId, teacherId, activeClassId },
 *      also kept as the request context's user (utils/requestContext) for the activity log
 *
 * The MySQL row is loaded on every request on purpose: a deactivated user's
 * still-valid token must stop working immediately.
 */
import { firebase } from '../config/firebase.js';
import { findAuthContextByFirebaseUid } from '../modules/users/users.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { tokenVerificationError } from '../utils/firebaseErrorMap.js';
import { runWithContext } from '../utils/requestContext.js';

export async function authenticate(req, _res, next) {
  // A request that falls through one authenticated mount into another (/assessments/:id/grades, then
  // /assessments) is checked once; the request context set below is still active.
  if (req.user) return next();
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
  runWithContext({ user }, () => next());
}
