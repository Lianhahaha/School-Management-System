import { createKeys } from '../../lib/queryKeys';

const base = createKeys('grades');

/**
 * Query keys for assessments and grades, which share one cache scope so that a single
 * `gradeKeys.all` invalidation covers both. list/detail address assessments
 * (GET /assessments, GET /assessments/:id).
 */
export const gradeKeys = {
  ...base,
  /** GET /assessments/:id/grades: the roster with scores. */
  roster: (assessmentId) => [...base.all, 'roster', String(assessmentId)],
  /** GET /grades: flat grade rows. */
  records: (params) => [...base.all, 'records', params],
  /** GET /grades/summary: params = filters and groupBy. */
  summary: (params) => [...base.all, 'summary', params],
};
