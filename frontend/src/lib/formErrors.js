/**
 * Maps a failed API call onto a react-hook-form form.
 *
 * The backend reports problems in three shapes (see backend ApiError):
 *   VALIDATION_ERROR  details.issues = [{ path: 'body.profile.guardianPhone', message }]  (zod)
 *                     details.field  = 'teacherId'                                        (database)
 *   CONFLICT          details.key    = 'users.uq_users_email'                             (unique key)
 *   anything else     no field: shown in the form's root alert
 *
 * Typical use, with `knownFields` so that an error for a field the form does not render is
 * still shown (in the root alert) instead of being lost:
 *
 *   const { setError, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
 *   const knownFields = Object.keys(schema.shape);
 *   const onSubmit = (values) =>
 *     mutation.mutateAsync(values).then(onClose).catch((e) => applyServerErrors(e, setError, { knownFields }));
 *   ...
 *   <FormRootError error={errors.root?.server} />
 */
import { ERROR_CODES } from '../constants/shared';
import { UNIQUE_KEY_FIELDS } from '../constants/ui';
import { ApiError } from './apiClient';

const SOURCE_PREFIX = /^(body|query|params)(\.|$)/;
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

const isMappedUniqueKey = (error) =>
  error.code === ERROR_CODES.CONFLICT && Object.hasOwn(UNIQUE_KEY_FIELDS, error.details?.key);

/**
 * True when a form (or a conflict list) renders this error itself. The global mutation error
 * handler skips its toast for these errors, so the component that sent the request must show them.
 */
export function isInlineFormError(error) {
  return (
    error.code === ERROR_CODES.VALIDATION_ERROR ||
    error.code === ERROR_CODES.SCHEDULE_CONFLICT ||
    isMappedUniqueKey(error) ||
    // An attendance or grade sheet that someone else saved meanwhile: the sheet offers a reload.
    error.details?.reason === 'sheet_changed'
  );
}

/**
 * @param {unknown} error whatever the mutation threw (normally an ApiError)
 * @param {Function} setError react-hook-form `setError`
 * @param {object} [options]
 * @param {Record<string, string>} [options.fieldMap] server field name to form field name, for forms
 *   that call a field differently, for example { studentNumber: 'profile.studentNumber' }
 * @param {string[]} [options.knownFields] top-level names of the fields the form renders
 */
export function applyServerErrors(error, setError, { fieldMap = {}, knownFields = null } = {}) {
  const setRootError = (message) => setError('root.server', { type: 'server', message });

  const setFieldError = (field, message) => {
    const name = fieldMap[field] ?? field;
    const isRendered =
      !knownFields || knownFields.some((known) => name === known || name.startsWith(`${known}.`));
    if (name === '' || !isRendered) return setRootError(name ? `${message} (${name})` : message);
    return setError(name, { type: 'server', message });
  };

  if (!(error instanceof ApiError)) return setRootError(GENERIC_MESSAGE);
  const { code, message, details } = error;

  if (code === ERROR_CODES.VALIDATION_ERROR) {
    if (Array.isArray(details?.issues) && details.issues.length > 0) {
      return details.issues.forEach((issue) =>
        setFieldError(issue.path.replace(SOURCE_PREFIX, ''), issue.message),
      );
    }
    if (details?.field) return setFieldError(details.field, message);
    return setRootError(message); // business-rule details such as invalidStudentIds are not field-shaped
  }

  if (isMappedUniqueKey(error)) {
    const { field, message: fieldMessage } = UNIQUE_KEY_FIELDS[details.key];
    return setFieldError(field, fieldMessage);
  }

  if (code === ERROR_CODES.RATE_LIMITED) {
    const seconds = details?.retryAfterSeconds;
    return setRootError(
      seconds
        ? `Too many attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`
        : 'Too many attempts. Try again later.',
    );
  }

  return setRootError(message);
}
