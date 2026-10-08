import { z } from 'zod';
import { BULK_MAX_ROWS } from '../../constants/shared';
import { optionalField, positiveInt, requiredId } from '../../lib/validators';

/**
 * Enroll or transfer one student: the modal knows the student, the form only picks the class.
 * Send `{ studentId, ...values }` to useEnrollStudent / useTransferStudent.
 */
export const classPickSchema = z.object({ classId: requiredId('Choose a class') });

/** The students of one bulk request (the API takes up to BULK_MAX_ROWS). */
const studentIdList = z
  .array(positiveInt)
  .min(1, 'Select at least one student')
  .max(BULK_MAX_ROWS, `Select at most ${BULK_MAX_ROWS} students at a time`);

/** Enroll many students into one class: send `{ classId, ...values }` to useEnrollStudents. */
export const enrollStudentsSchema = z.object({ studentIds: studentIdList });

/**
 * End of a school year: the students whose year closes, and the class they move on to ('' = none yet).
 * Send `{ classId, ...values }` to useCompleteSchoolYear.
 */
export const completeSchoolYearSchema = z.object({
  studentIds: studentIdList,
  nextClassId: optionalField(positiveInt),
});

export const classPickDefaults = { classId: '' };
