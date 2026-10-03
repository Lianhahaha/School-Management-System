import { z } from 'zod';
import { ASSESSMENT_TYPES, TERMS } from '../../constants/shared.js';
import { bulkArray, id, idOrMe, idParams, listQuery, score, shortText } from '../../utils/zod/common.js';
import { GRADE_SORT_MAP } from './grades.repository.js';

const scopeFilters = {
  studentId: idOrMe.optional(),
  classSubjectId: id.optional(),
  classId: id.optional(),
  term: z.enum(TERMS).optional(),
};

export const listGradesQuery = listQuery(
  Object.keys(GRADE_SORT_MAP),
  {
    ...scopeFilters,
    assessmentId: id.optional(),
    type: z.enum(ASSESSMENT_TYPES).optional(),
  },
  { searchable: false },
);

export const gradeSummaryQuery = z.strictObject({
  ...scopeFilters,
  groupBy: z.enum(['classSubject', 'student']).default('classSubject'),
});

/** `score <= maxScore` depends on the assessment row, so the service checks the upper bound. */
export const saveGradesBody = z.strictObject({
  grades: bulkArray(
    z.strictObject({ studentId: id, score, remarks: shortText(255).nullable().optional() }),
    'studentId',
  ),
});

export { idParams };
