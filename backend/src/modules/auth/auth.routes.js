/**
 * /auth: POST /register is public (rate limited; disabled with ALLOW_PUBLIC_REGISTRATION=false);
 * GET and PATCH /me require a signed-in user.
 *
 * Two limits per IP address, sized for a school lab where a whole class registers from one public IP:
 *   - 30 successful registrations per 15 minutes;
 *   - REGISTER_FAILED_LIMIT rejected attempts (400, 409) per 15 minutes, generous enough for a class
 *     fixing typos, but it stops a script from testing thousands of addresses for an account.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import * as controller from './auth.controller.js';
import * as schemas from './auth.schemas.js';

export const authRoutes = Router();

export const REGISTER_FAILED_LIMIT = 150;

const rateLimitHandler = (req, _res, next, options) => {
  const resetAt = req.rateLimit?.resetTime?.getTime();
  const retryAfterSeconds = resetAt
    ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    : options.windowMs / 1000;
  next(ApiError.rateLimited(retryAfterSeconds));
};

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// No RateLimit headers of its own: the ones the client sees describe the registration limit above.
const failedAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: REGISTER_FAILED_LIMIT,
  skipSuccessfulRequests: true,
  standardHeaders: false,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

function registrationEnabled(_req, _res, next) {
  if (!env.ALLOW_PUBLIC_REGISTRATION) {
    return next(ApiError.notFound('route', 'POST /auth/register', { reason: 'registration_disabled' }));
  }
  next();
}

authRoutes.post(
  '/register',
  registrationEnabled,
  failedAttemptLimiter,
  registerLimiter,
  validate({ body: schemas.registerBody }),
  controller.register,
);
authRoutes.get('/me', authenticate, controller.me);
authRoutes.patch('/me', authenticate, validate({ body: schemas.updateMeBody }), controller.updateMe);
