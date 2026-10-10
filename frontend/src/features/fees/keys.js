import { createKeys } from '../../lib/queryKeys';

const base = createKeys('fees');

/**
 * Query keys for fees and payments, which share one cache scope so that a single `feeKeys.all`
 * invalidation refreshes both the fee lists (GET /fees) and the statements.
 */
export const feeKeys = {
  ...base,
  /** GET /fees/statement: params = { studentId, academicYear }. */
  statement: (params) => [...base.all, 'statement', params],
};
