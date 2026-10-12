/**
 * Rate limits. Sign-up has its own per-IP limits (modules/auth/auth.routes.js); every signed-in request
 * counts against a per-USER limit here, not a per-IP one: a whole school often reaches the internet through
 * one public address, and a per-IP limit would let one busy classroom lock out everyone else.
 *
 * The limit (API_RATE_LIMIT_PER_MINUTE, default 600) sits far above what the web app sends: every open page
 * refreshes its data every 20 seconds, about 45 requests a minute for a busy dashboard, plus bursts while a
 * long list loads page by page. A script hammering the API reaches it within seconds and gets 429.
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Answers a limited request with 429 RATE_LIMITED and Retry-After, in the API's error envelope. */
export function rateLimitHandler(req, _res, next, options) {
  const resetAt = req.rateLimit?.resetTime?.getTime();
  const retryAfterSeconds = resetAt
    ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    : options.windowMs / 1000;
  next(ApiError.rateLimited(retryAfterSeconds));
}

/** Requests per minute per signed-in user; runs after authentication, so `req.user` is set. */
export const perUserLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_PER_MINUTE,
  keyGenerator: (req) => `user:${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
