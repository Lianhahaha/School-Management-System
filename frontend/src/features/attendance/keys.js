import { createKeys } from '../../lib/queryKeys';

const base = createKeys('attendance');

/** Query keys for attendance. list/detail address flat records (GET /attendance, GET /attendance/:id). */
export const attendanceKeys = {
  ...base,
  /** GET /attendance/sheet: params = { classSubjectId, date }. */
  sheet: (params) => [...base.all, 'sheet', params],
  /** GET /attendance/summary: params = filters and groupBy. */
  summary: (params) => [...base.all, 'summary', params],
};
