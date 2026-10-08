import { z } from 'zod';
import { ASSESSMENT_TYPES, GRADING_GROUPS } from '../../constants/shared';
import { nullableField, optionalField, subjectCode } from '../../lib/validators';

/** One weight input: blank counts as 0, otherwise a whole percent from 0 to 100. */
const weightInput = z
  .string()
  .trim()
  .transform((value) => (value === '' ? '0' : value))
  .pipe(
    z.coerce
      .number({ error: 'Enter a whole number' })
      .int('Enter a whole number')
      .min(0, 'Use 0 to 100')
      .max(100, 'Use 0 to 100'),
  );

/** The sum of the weight inputs (blank and invalid inputs count 0), for the live total and the check. */
export const weightsTotal = (weights) =>
  ASSESSMENT_TYPES.reduce((sum, type) => {
    const value = Number(weights?.[type] || 0);
    return sum + (Number.isInteger(value) && value > 0 ? value : 0);
  }, 0);

/** Both forms share these fields; only the meaning of a blank input differs (see `blank`). */
const subjectShape = (blank) => ({
  code: subjectCode,
  name: z.string().trim().min(1, 'This field is required').max(100, 'Use 100 characters or fewer'),
  description: blank(z.string().max(1000, 'Use 1000 characters or fewer')),
  gradingMethod: z.enum(['k12', 'points', 'weighted']),
  gradingGroup: z.enum(GRADING_GROUPS),
  weights: z.object(Object.fromEntries(ASSESSMENT_TYPES.map((type) => [type, weightInput]))),
});

/**
 * Grading: K-12 components with a subject group, on points, or weighted per assessment type with weights
 * that add up to 100. The form's `gradingMethod`, `gradingGroup` and `weights` become the API's
 * `gradingGroup` and `gradeWeights` (at most one of them set, both null on points).
 */
const subjectSchema = (blank) =>
  z
    .object(subjectShape(blank))
    .refine((values) => values.gradingMethod !== 'weighted' || weightsTotal(values.weights) === 100, {
      message: 'The weights must add up to 100%',
      path: ['weights'],
    })
    .transform(({ gradingMethod, gradingGroup, weights, ...subject }) => ({
      ...subject,
      gradingGroup: gradingMethod === 'k12' ? gradingGroup : null,
      gradeWeights: gradingMethod === 'weighted' ? weights : null,
    }));

/** POST /subjects: a blank description is left out. */
export const createSubjectSchema = subjectSchema(optionalField);

/** PATCH /subjects/:id from the edit form: a blank description clears it (null). Retiring is `{ isActive }` without a form. */
export const updateSubjectSchema = subjectSchema(nullableField);

/** The form's grading method for a subject; a new subject starts on K-12 components. */
const methodOf = (subject) => {
  if (!subject || subject.gradingGroup) return 'k12';
  return subject.gradeWeights ? 'weighted' : 'points';
};

/** Form values; call without an argument for the create form. Weights are text inputs. */
export const subjectDefaults = (subject) => ({
  code: subject?.code ?? '',
  name: subject?.name ?? '',
  description: subject?.description ?? '',
  gradingMethod: methodOf(subject),
  gradingGroup: subject?.gradingGroup ?? 'languages',
  weights: Object.fromEntries(
    ASSESSMENT_TYPES.map((type) => [
      type,
      subject?.gradeWeights?.[type] ? String(subject.gradeWeights[type]) : '',
    ]),
  ),
});
