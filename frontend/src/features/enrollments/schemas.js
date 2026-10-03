import { z } from 'zod';
import { BULK_MAX_ROWS } from '../../constants/shared';
import { positiveInt, requiredId } from '../../lib/validators';

/**
 * Enroll or transfer one student: the modal knows the student, the form only picks the class.
 * Send `{ studentId, ...values }` to useEnrollStudent / useTransferStudent.
 */
export const classPickSchema = z.object({ classId: requiredId('Choose a class') });

/** Enroll many students into one class: send `{ classId, ...values }` to useEnrollStudents. */
export const enrollStudentsSchema = z.object({
  studentIds: z
    .array(positiveInt)
    .min(1, 'Select at least one student')
    .max(BULK_MAX_ROWS, `Select at most ${BULK_MAX_ROWS} students at a time`),
});

export const classPickDefaults = { classId: '' };
