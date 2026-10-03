/**
 * Translates MySQL driver errors into ApiError. zod should prevent all of the
 * 400 cases; if one shows up in the logs, a schema rule is missing.
 */
import { ApiError } from './ApiError.js';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ER_CON_COUNT_ERROR',
  'ENOTFOUND',
]);

const toCamel = (name) => name.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

export function isMysqlError(error) {
  return Boolean(error && (typeof error.errno === 'number' || CONNECTION_CODES.has(error.code)));
}

export function mysqlErrorMap(error) {
  const text = error.sqlMessage ?? error.message ?? '';
  switch (error.code) {
    case 'ER_DUP_ENTRY': {
      const key = /for key '([^']+)'/.exec(text)?.[1];
      return ApiError.conflict(`duplicate value for ${key ?? 'unique key'}`, { key });
    }
    case 'ER_ROW_IS_REFERENCED_2': {
      const constraint = /CONSTRAINT `([^`]+)`/.exec(text)?.[1];
      return ApiError.conflict('cannot delete, the record is still in use', { reason: 'in_use', constraint });
    }
    case 'ER_NO_REFERENCED_ROW_2': {
      const column = /FOREIGN KEY \(`(\w+)`\)/.exec(text)?.[1];
      return ApiError.validation('referenced record does not exist', undefined, {
        reason: 'invalid_reference',
        field: column ? toCamel(column) : undefined,
      });
    }
    case 'ER_BAD_NULL_ERROR': {
      const column = /Column '(\w+)'/.exec(text)?.[1];
      return ApiError.validation('field cannot be null', undefined, {
        field: column ? toCamel(column) : undefined,
      });
    }
    case 'ER_DATA_TOO_LONG': {
      const column = /for column '(\w+)'/.exec(text)?.[1];
      return ApiError.validation('value too long', undefined, {
        field: column ? toCamel(column) : undefined,
      });
    }
    case 'WARN_DATA_TRUNCATED':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD': {
      const column = /for column '(\w+)'/.exec(text)?.[1];
      return ApiError.validation('invalid value for field', undefined, {
        field: column ? toCamel(column) : undefined,
      });
    }
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const constraint = /constraint '([^']+)'/i.exec(text)?.[1];
      return ApiError.validation('check constraint violated', undefined, { constraint });
    }
    default:
      if (CONNECTION_CODES.has(error.code)) return ApiError.unavailable('db');
      return ApiError.internal();
  }
}
