/**
 * authenticate — turns `Authorization: Bearer <Firebase ID token>` into req.user.
 *
 *   1. missing / malformed header            -> 401 UNAUTHORIZED
 *   2. token rejected by Firebase            -> 401 UNAUTHORIZED (details.reason = Firebase code)
 *   3. no users row for the Firebase uid     -> 403 USER_NOT_REGISTERED
 *   4. users.is_active = 0                   -> 403 ACCOUNT_DISABLED
 *   5. req.user = { id, firebaseUid, email, firstName, lastName, role, studentId, teacherId, activeClassId }
 *
 * The MySQL row is loaded on every request on purpose: a deactivated user's
 * still-valid token must stop working immediately.
 */
import { firebase } from '../config/firebase.js';
import { findAuthContextByFirebaseUid } from '../modules/users/users.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { firebaseErrorMap, isFirebaseError } from '../utils/firebaseErrorMap.js';

export async function authenticate(req, _res, next) {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token)
    return next(ApiError.unauthorized('missing bearer token', 'missing_token'));

  let decoded;
  try {
    decoded = await firebase.verifyIdToken(token);
  } catch (error) {
    return next(
      isFirebaseError(error)
        ? firebaseErrorMap(error)
        : ApiError.unauthorized('invalid token', 'invalid_token'),
    );
  }

  const user = await findAuthContextByFirebaseUid(decoded.uid);
  if (!user) return next(ApiError.notRegistered(decoded.uid));
  if (!user.isActive) return next(ApiError.accountDisabled());

  req.user = user;
  next();
}
