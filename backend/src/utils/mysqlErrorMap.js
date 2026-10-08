/**
 * Translates MySQL driver errors into ApiError. zod should prevent all of the
 * 400 cases; if one shows up in the logs, a schema rule is missing.
 */
import { ApiError } from './ApiError.js';
import { toCamel } from './sql.js';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ETIMEDOUT',
  'ER_CON_COUNT_ERROR',
  'ER_SERVER_SHUTDOWN',
  'ENOTFOUND',
]);

/** Refusals that a second attempt normally gets past. */
const BUSY_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

/** mysql2's pool rejects with a plain Error (no code) when more requests wait than queueLimit allows. */
const isPoolQueueFull = (error) => error?.message === 'Queue limit reached.' && error.code === undefined;

/**
 * What a refused delete says, by the foreign key that refused it. MySQL names only the first key that
 * refuses, so each sentence names everything that can hold the record. Other keys get the general sentence.
 */
const CLASS_IN_USE = 'this class still has subjects, students or announcements, so it cannot be deleted';
const LESSON_IN_USE =
  'this subject already has attendance or assessments in this class, so it cannot be removed';
const IN_USE_MESSAGES = {
  fk_class_subjects_class: CLASS_IN_USE,
  fk_enrollments_class: CLASS_IN_USE,
  fk_announcements_class: CLASS_IN_USE,
  fk_class_subjects_subject: 'this subject is taught in a class, so it cannot be deleted. Retire it instead',
  fk_schedules_class_subject: 'this subject still has periods on the schedule. Remove its periods first',
  fk_attendance_class_subject: LESSON_IN_USE,
  fk_assessments_class_subject: LESSON_IN_USE,
};

export function isMysqlError(error) {
  return Boolean(
    error && (typeof error.errno === 'number' || CONNECTION_CODES.has(error.code) || isPoolQueueFull(error)),
  );
}

export function mysqlErrorMap(error) {
  if (isPoolQueueFull(error) || BUSY_CODES.has(error.code)) return ApiError.busy();
  const text = error.sqlMessage ?? error.message ?? '';
  switch (error.code) {
    case 'ER_DUP_ENTRY': {
      const key = /for key '([^']+)'/.exec(text)?.[1];
      return ApiError.conflict('this already exists', { key });
    }
    case 'ER_ROW_IS_REFERENCED_2': {
      const constraint = /CONSTRAINT `([^`]+)`/.exec(text)?.[1];
      const message =
        IN_USE_MESSAGES[constraint] ?? 'this is still used by other records, so it cannot be deleted';
      return ApiError.conflict(message, { reason: 'in_use', constraint });
    }
    case 'ER_NO_REFERENCED_ROW_2': {
      const column = /FOREIGN KEY \(`(\w+)`\)/.exec(text)?.[1];
      return ApiError.validation('the chosen record no longer exists', undefined, {
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
