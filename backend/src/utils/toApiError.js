/**
 * toApiError — turns any thrown value into an ApiError. Used by the error handler for every response,
 * and by code that reports a failure inside a successful response (an import row) without leaking the
 * underlying driver or Firebase message.
 *
 * Decision order: ApiError -> zod error -> body-parser error -> undecodable URL -> Firebase error
 * -> MySQL error -> 500.
 */
import { ZodError } from 'zod';
import { ApiError } from './ApiError.js';
import { firebaseErrorMap, isFirebaseError } from './firebaseErrorMap.js';
import { isMysqlError, mysqlErrorMap } from './mysqlErrorMap.js';

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
  // The router reports a path it cannot decode (e.g. "/students/%E0%A4") as a URIError.
  if (error instanceof URIError) {
    return ApiError.validation('malformed request URL', undefined, { reason: 'bad_request' });
  }
  if (isFirebaseError(error)) return firebaseErrorMap(error);
  if (isMysqlError(error)) return mysqlErrorMap(error);
  return ApiError.internal();
}
