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
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token)
    return next(ApiError.unauthorized('missing bearer token', 'missing_token'));

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
