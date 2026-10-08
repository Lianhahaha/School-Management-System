import { z } from 'zod';
import { ASSESSMENT_TYPES, GRADING_GROUPS } from '../../constants/shared.js';
import {
  boolQuery,
  idParams,
  listQuery,
  optionalText,
  patchOf,
  shortText,
  subjectCode,
} from '../../utils/zod/common.js';
import { SUBJECT_SORT_MAP } from './subjects.repository.js';

const name = shortText(100).min(1, { error: 'required' });
const description = optionalText(1000);

/** Percent per assessment type, whole numbers adding up to 100; a type left out counts 0. */
const gradeWeights = z
  .strictObject(
    Object.fromEntries(ASSESSMENT_TYPES.map((type) => [type, z.number().int().min(0).max(100).optional()])),
  )
  .refine((weights) => Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0) === 100, {
    error: 'weights must add up to 100',
  });

/** The K-12 subject group; null: not graded by K-12 components. */
const gradingGroup = z.enum(GRADING_GROUPS);

/** A subject is graded one way: K-12 components (`gradingGroup`) or custom weights, not both. */
const oneGradingMethod = [
  (body) => !(body.gradingGroup && body.gradeWeights),
  { error: 'choose either a grading group or custom weights', path: ['gradingGroup'] },
];

export const listSubjectsQuery = listQuery(Object.keys(SUBJECT_SORT_MAP), { isActive: boolQuery.optional() });

/** Neither `gradingGroup` nor `gradeWeights`: the subject is graded on points. */
export const createSubjectBody = z
  .strictObject({
    code: subjectCode,
    name,
    description: description.nullable().optional(),
    gradingGroup: gradingGroup.nullable().optional(),
    gradeWeights: gradeWeights.nullable().optional(),
  })
  .refine(...oneGradingMethod);

/** Setting a grading group clears custom weights, and setting weights clears the group (subjects.service). */
export const updateSubjectBody = patchOf({
  code: subjectCode,
  name,
  description: description.nullable(),
  isActive: z.boolean(),
  gradingGroup: gradingGroup.nullable(),
  gradeWeights: gradeWeights.nullable(),
}).refine(...oneGradingMethod);

export { idParams };
