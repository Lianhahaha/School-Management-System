import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '../../constants/shared.js';
import {
  bulkArray,
  dateRangeRefinement,
  dateStr,
  id,
  idOrMe,
  idParams,
  listQuery,
  patchOf,
  shortText,
} from '../../utils/zod/common.js';
import { ATTENDANCE_SORT_MAP } from './attendance.repository.js';

const status = z.enum(ATTENDANCE_STATUSES);
const remarks = shortText(255);

export const listAttendanceQuery = listQuery(
  Object.keys(ATTENDANCE_SORT_MAP),
  {
    studentId: idOrMe.optional(),
    classSubjectId: id.optional(),
    classId: id.optional(),
    status: status.optional(),
    dateFrom: dateStr.optional(),
    dateTo: dateStr.optional(),
  },
  { searchable: false },
).refine(...dateRangeRefinement);

export const summaryQuery = z
  .strictObject({
    studentId: idOrMe.optional(),
    classSubjectId: id.optional(),
    classId: id.optional(),
    dateFrom: dateStr.optional(),
    dateTo: dateStr.optional(),
    groupBy: z.enum(['none', 'student', 'classSubject', 'week']).default('none'),
  })
  .refine(...dateRangeRefinement);

export const sheetQuery = z.strictObject({ classSubjectId: id, date: dateStr });

export const saveSheetBody = z.strictObject({
  classSubjectId: id,
  date: dateStr,
  records: bulkArray(
    z.strictObject({ studentId: id, status, remarks: remarks.nullable().optional() }),
    'studentId',
  ),
});

export const updateAttendanceBody = patchOf({ status, remarks: remarks.nullable() });

export { idParams };
