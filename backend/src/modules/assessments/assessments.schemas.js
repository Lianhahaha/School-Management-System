import { z } from 'zod';
import { ASSESSMENT_TYPES, TERMS } from '../../constants/shared.js';
import {
  dateRangeRefinement,
  dateStr,
  id,
  idParams,
  listQuery,
  patchOf,
  shortText,
} from '../../utils/zod/common.js';
import { ASSESSMENT_SORT_MAP } from './assessments.repository.js';

const title = shortText(150).min(1, { error: 'required' });
const type = z.enum(ASSESSMENT_TYPES);
const term = z.enum(TERMS);
const maxScore = z.number().positive().max(1000).multipleOf(0.01);

export const listAssessmentsQuery = listQuery(Object.keys(ASSESSMENT_SORT_MAP), {
  classSubjectId: id.optional(),
  classId: id.optional(),
  type: type.optional(),
  term: term.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
}).refine(...dateRangeRefinement);

export const createAssessmentBody = z.strictObject({
  classSubjectId: id,
  title,
  type,
  term,
  maxScore,
  assessedOn: dateStr.optional(),
});

/** The class-subject of an assessment is immutable. */
export const updateAssessmentBody = patchOf({ title, type, term, maxScore, assessedOn: dateStr });

export { idParams };
