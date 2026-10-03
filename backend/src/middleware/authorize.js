/**
 * authorize(...roles) — role gate for a route. Must run after `authenticate`.
 */
import { ApiError } from '../utils/ApiError.js';

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.internal('authorize() used before authenticate()'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('role_not_allowed', 'your role is not allowed to perform this action'));
    }
    next();
  };
}
