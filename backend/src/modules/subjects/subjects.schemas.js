import { z } from 'zod';
import { ASSESSMENT_TYPES } from '../../constants/shared.js';
import { boolQuery, idParams, listQuery, patchOf, shortText, subjectCode } from '../../utils/zod/common.js';
import { SUBJECT_SORT_MAP } from './subjects.repository.js';

const name = shortText(100).min(1, { error: 'required' });
const description = shortText(1000);

/** Percent per assessment type, whole numbers adding up to 100; a type left out counts 0. */
const gradeWeights = z
  .strictObject(
    Object.fromEntries(ASSESSMENT_TYPES.map((type) => [type, z.number().int().min(0).max(100).optional()])),
  )
  .refine((weights) => Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0) === 100, {
    error: 'weights must add up to 100',
  });

export const listSubjectsQuery = listQuery(Object.keys(SUBJECT_SORT_MAP), { isActive: boolQuery.optional() });

/** `gradeWeights` null or left out: the subject is graded on points. */
export const createSubjectBody = z.strictObject({
  code: subjectCode,
  name,
  description: description.nullable().optional(),
  gradeWeights: gradeWeights.nullable().optional(),
});

export const updateSubjectBody = patchOf({
  code: subjectCode,
  name,
  description: description.nullable(),
  isActive: z.boolean(),
  gradeWeights: gradeWeights.nullable(),
});

export { idParams };
