/**
 * errorHandler — the single place that turns any thrown value into the error
 * envelope. Registered last, with the 4-argument signature Express requires.
 *
 * Decision order: ApiError -> zod error -> body-parser error -> Firebase error
 * -> MySQL error -> 500. The underlying failure (the thrown value itself, or
 * the `cause` of an ApiError) is logged server-side, and returned in
 * `details` for 5xx responses only outside production.
 */
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { firebaseErrorMap, isFirebaseError } from '../utils/firebaseErrorMap.js';
import { logger } from '../utils/logger.js';
import { isMysqlError, mysqlErrorMap } from '../utils/mysqlErrorMap.js';

/** body-parser marks its errors with a string `type` and a 4xx `status`. */
const isBodyParserClientError = (error) =>
  typeof error?.type === 'string' &&
  Number.isInteger(error.status) &&
  error.status >= 400 &&
  error.status < 500;

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return ApiError.validation(error, undefined);
  if (error?.type === 'entity.parse.failed') {
    return ApiError.validation('malformed JSON body', 'body', { reason: 'invalid_json' });
  }
  if (error?.type === 'entity.too.large') {
    return ApiError.validation('payload exceeds the 1mb limit', 'body', { reason: 'payload_too_large' });
  }
  // Any other body-parser refusal (unsupported charset or encoding, aborted or mis-sized request) is the
  // client's request, not a server failure.
  if (isBodyParserClientError(error)) {
    return ApiError.validation(error.message, 'body', { reason: error.type });
  }
  if (isFirebaseError(error)) return firebaseErrorMap(error);
  if (isMysqlError(error)) return mysqlErrorMap(error);
  return ApiError.internal();
}

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
