import { z } from 'zod';
import { nullableField, optionalField, subjectCode } from '../../lib/validators';

/** Both forms share these fields; only the meaning of a blank input differs (see `blank`). */
const subjectShape = (blank) => ({
  code: subjectCode,
  name: z.string().trim().min(1, 'This field is required').max(100, 'Use 100 characters or fewer'),
  description: blank(z.string().max(1000, 'Use 1000 characters or fewer')),
});

/** POST /subjects: a blank description is left out. */
export const createSubjectSchema = z.object(subjectShape(optionalField));

/** PATCH /subjects/:id from the edit form: a blank description clears it (null). Retiring is `{ isActive }` without a form. */
export const updateSubjectSchema = z.object(subjectShape(nullableField));

/** Form values; call without an argument for the create form. */
export const subjectDefaults = (subject) => ({
  code: subject?.code ?? '',
  name: subject?.name ?? '',
  description: subject?.description ?? '',
});
