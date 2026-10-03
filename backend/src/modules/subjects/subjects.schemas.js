import { z } from 'zod';
import { boolQuery, idParams, listQuery, patchOf, shortText, subjectCode } from '../../utils/zod/common.js';
import { SUBJECT_SORT_MAP } from './subjects.repository.js';

const name = shortText(100).min(1, { error: 'required' });
const description = shortText(1000);

export const listSubjectsQuery = listQuery(Object.keys(SUBJECT_SORT_MAP), { isActive: boolQuery.optional() });

export const createSubjectBody = z.strictObject({
  code: subjectCode,
  name,
  description: description.nullable().optional(),
});

export const updateSubjectBody = patchOf({
  code: subjectCode,
  name,
  description: description.nullable(),
  isActive: z.boolean(),
});

export { idParams };
