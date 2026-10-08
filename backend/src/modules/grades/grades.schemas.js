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

const remarks = shortText(255);

/**
 * `score <= maxScore` depends on the assessment row, so the service checks the upper bound. `previous` is
 * the grade the client last saw for that student (score null = not graded yet); when the stored grade
 * differs, someone else saved meanwhile and the whole save is refused (409 sheet_changed).
 */
export const saveGradesBody = z.strictObject({
  grades: bulkArray(
    z.strictObject({
      studentId: id,
      score,
      remarks: remarks.nullable().optional(),
      previous: z.strictObject({ score: score.nullable(), remarks: remarks.nullable() }).optional(),
    }),
    'studentId',
  ),
});

export { idParams };
