/**
 * errorHandler — the single place that turns any thrown value into the error
 * envelope. Registered last, with the 4-argument signature Express requires.
 *
 * The mapping itself is utils/toApiError. The underlying failure (the thrown value
 * itself, or the `cause` of an ApiError) is logged server-side, and returned in
 * `details` for 5xx responses only outside production.
 */
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { toApiError } from '../utils/toApiError.js';

export function errorHandler(error, req, res, next) {
  const apiError = toApiError(error);
  const cause = error === apiError ? apiError.cause : error;
  const meta = {
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id ?? null,
    code: apiError.code,
  };

  if (apiError.status >= 500) {
    logger.error(apiError.message, { ...meta, cause: cause?.message, stack: (cause ?? error)?.stack });
  } else {
    logger.warn(apiError.message, { ...meta, details: apiError.details, cause: cause?.message });
  }

  if (res.headersSent) return next(error);

  const body = apiError.toJSON();
  if (apiError.status >= 500 && !env.isProd && cause !== undefined) {
    body.error.details = {
      ...body.error.details,
      cause: cause?.message,
      stack: typeof cause?.stack === 'string' ? cause.stack.split('\n') : undefined,
    };
  }
  if (apiError.status === 429 && apiError.details?.retryAfterSeconds) {
    res.setHeader('Retry-After', String(apiError.details.retryAfterSeconds));
  }
  res.status(apiError.status).json(body);
}
