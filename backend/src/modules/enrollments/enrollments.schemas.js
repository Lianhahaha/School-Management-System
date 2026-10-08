import { z } from 'zod';
import { ENROLLMENT_STATUSES } from '../../constants/shared.js';
import { academicYear, id, idList, idOrMe, idParams, listQuery } from '../../utils/zod/common.js';
import { ENROLLMENT_SORT_MAP } from './enrollments.repository.js';

export const listEnrollmentsQuery = listQuery(
  Object.keys(ENROLLMENT_SORT_MAP),
  {
    studentId: idOrMe.optional(),
    classId: id.optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    academicYear: academicYear.optional(),
  },
  { searchable: false },
);

export const enrollBody = z.strictObject({ studentId: id, classId: id });

export const enrollManyBody = z.strictObject({ classId: id, studentIds: idList });

export const transferBody = z.strictObject({ studentId: id, classId: id });

/** End of a school year: close these students' enrollments in `classId`, optionally enroll them in `nextClassId`. */
export const completeYearBody = z.strictObject({
  classId: id,
  studentIds: idList,
  nextClassId: id.optional(),
});

/** Only closing transitions exist; `active` can be reached solely through enroll / transfer. */
export const setStatusBody = z.strictObject({ status: z.enum(['completed', 'withdrawn']) });

export { idParams };
