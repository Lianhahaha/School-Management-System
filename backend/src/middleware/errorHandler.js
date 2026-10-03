/**
 * errorHandler — the single place that turns any thrown value into the error
 * envelope. Registered last, with the 4-argument signature Express requires.
 *
 * Decision order: ApiError -> zod error -> body-parser error -> Firebase error
 * -> MySQL error -> 500. Stack traces are logged server-side and returned in
 * `details` only outside production.
 */
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { firebaseErrorMap, isFirebaseError } from '../utils/firebaseErrorMap.js';
import { logger } from '../utils/logger.js';
import { isMysqlError, mysqlErrorMap } from '../utils/mysqlErrorMap.js';

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return ApiError.validation(error, undefined);
  if (error?.type === 'entity.parse.failed') {
    return ApiError.validation('malformed JSON body', 'body', { reason: 'invalid_json' });
  }
  if (error?.type === 'entity.too.large') {
    return ApiError.validation('payload exceeds the 1mb limit', 'body', { reason: 'payload_too_large' });
  }
  if (isFirebaseError(error)) return firebaseErrorMap(error);
  if (isMysqlError(error)) return mysqlErrorMap(error);
  return ApiError.internal();
}

export function errorHandler(error, req, res, next) {
  const apiError = toApiError(error);
  const meta = {
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id ?? null,
    code: apiError.code,
  };

  if (apiError.status >= 500) {
    logger.error(apiError.message, { ...meta, cause: error?.message, stack: error?.stack });
  } else {
    logger.warn(apiError.message, { ...meta, details: apiError.details });
  }

  if (res.headersSent) return next(error);

  const body = apiError.toJSON();
  if (apiError.status >= 500 && !env.isProd && error !== apiError) {
    body.error.details = {
      ...body.error.details,
      cause: error?.message,
      stack: typeof error?.stack === 'string' ? error.stack.split('\n') : undefined,
    };
  }
  if (apiError.status === 429 && apiError.details?.retryAfterSeconds) {
    res.setHeader('Retry-After', String(apiError.details.retryAfterSeconds));
  }
  res.status(apiError.status).json(body);
}
