/**
 * validate({ params, query, body }) — parses the request parts with zod and
 * stores the typed results on `req.validated`. Controllers read only from
 * there (Express 5 makes `req.query` a read-only getter, so it is never
 * reassigned). Unknown keys fail because every schema is strict.
 */
import { ApiError } from '../utils/ApiError.js';

const PARTS = ['params', 'query', 'body'];

export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const input = req[part] ?? {};
      if (part === 'body' && req.body === undefined && req.method !== 'GET') {
        return next(
          ApiError.validation('JSON body missing or Content-Type is not application/json', 'body', {
            reason: 'missing_body',
          }),
        );
      }
      const result = schema.safeParse(input);
      if (!result.success) return next(ApiError.validation(result.error, part));
      validated[part] = result.data;
    }
    req.validated = validated;
    next();
  };
}
