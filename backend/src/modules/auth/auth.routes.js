/**
 * /auth: POST /register is public (rate limited; disabled with ALLOW_PUBLIC_REGISTRATION=false);
 * GET and PATCH /me require a signed-in user.
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

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, _res, next, options) => {
    const resetAt = req.rateLimit?.resetTime?.getTime();
    const retryAfterSeconds = resetAt
      ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      : options.windowMs / 1000;
    next(ApiError.rateLimited(retryAfterSeconds));
  },
});

function registrationEnabled(_req, _res, next) {
  if (!env.ALLOW_PUBLIC_REGISTRATION) return next(ApiError.notFound('route', 'POST /auth/register'));
  next();
}

authRoutes.post(
  '/register',
  registrationEnabled,
  registerLimiter,
  validate({ body: schemas.registerBody }),
  controller.register,
);
authRoutes.get('/me', authenticate, controller.me);
authRoutes.patch('/me', authenticate, validate({ body: schemas.updateMeBody }), controller.updateMe);
