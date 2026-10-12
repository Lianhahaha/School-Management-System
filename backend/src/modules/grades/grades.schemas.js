import { z } from 'zod';
import { ASSESSMENT_TYPES, SEMESTERS, TERMS } from '../../constants/shared.js';
import {
  academicYear,
  bulkArray,
  id,
  idOrMe,
  idParams,
  listQuery,
  score,
  shortText,
} from '../../utils/zod/common.js';
import { GRADE_SORT_MAP } from './grades.repository.js';

const scopeFilters = {
  studentId: idOrMe.optional(),
  classSubjectId: id.optional(),
  classId: id.optional(),
  /** The academic year of the assessment's class. */
  academicYear: academicYear.optional(),
  /** The semester of the school year, with its own four quarters. */
  semester: z.enum(SEMESTERS).optional(),
  /** The quarter within the semester (all semesters' quarters of that number without `semester`). */
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

/** A score in the query string: a whole number or one with at most 2 decimals ('18', '17.5'). */
const queryScore = z.preprocess(
  (value) => (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : value),
  score,
);

/**
 * DELETE /grades/:id: the grade the client last saw, its `score` and `remarks` (left out for none). When the
 * stored grade differs, or is gone, someone saved meanwhile and nothing is deleted (409 sheet_changed). Without
 * `score` the grade is deleted as it is.
 */
export const deleteGradeQuery = z
  .strictObject({ score: queryScore.optional(), remarks: remarks.optional() })
  .refine((query) => query.remarks === undefined || query.score !== undefined, {
    error: 'remarks are checked together with the score',
    path: ['remarks'],
  });

export { idParams };
