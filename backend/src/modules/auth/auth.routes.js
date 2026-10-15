/**
 * /auth: POST /register is public (rate limited; disabled with ALLOW_PUBLIC_REGISTRATION=false);
 * GET and POST /demo are public (the one-tap demo sign-in; off while the DEMO_ACCOUNT_EMAIL account is missing
 * or deactivated);
 * GET and PATCH /me require a signed-in user. They are the only routes a student assistant whose sign-up is
 * pending or declined may use (authenticateOwnAccount); every other route refuses them (authenticate).
 *
 * Two limits per IP address, sized for a school lab where a whole class registers from one public IP:
 *   - 30 successful registrations per 15 minutes;
 *   - REGISTER_FAILED_LIMIT rejected attempts (400, 409) per 15 minutes, generous enough for a class
 *     fixing typos, but it stops a script from testing thousands of addresses for an account.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticateOwnAccount } from '../../middleware/authenticate.js';
import { rateLimitHandler } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import * as controller from './auth.controller.js';
import * as schemas from './auth.schemas.js';

export const authRoutes = Router();

export const REGISTER_FAILED_LIMIT = 150;

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

export const DEMO_SIGN_IN_LIMIT = 60;

// One-tap demo sign-ins per IP address and 15 minutes: plenty for a room of visitors, not for a script.
const demoSignInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: DEMO_SIGN_IN_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// The demo account (DEMO_ACCOUNT_EMAIL): who the sign-in page offers, and a token to sign in as it.
authRoutes.get('/demo', controller.demo);
authRoutes.post('/demo', demoSignInLimiter, controller.demoSignIn);
// The caller's own account: also open to a student assistant awaiting approval (or declined).
authRoutes.get('/me', authenticateOwnAccount, controller.me);
authRoutes.patch(
  '/me',
  authenticateOwnAccount,
  validate({ body: schemas.updateMeBody }),
  controller.updateMe,
);
