import { z } from 'zod';
import { BULK_MAX_ROWS } from '../../constants/shared.js';
import { dateStr, email, name, phone, shortText, studentNumber } from '../../utils/zod/common.js';
import { studentDetailFields } from '../../utils/zod/profiles.js';

/** A cell as it came out of the spreadsheet; blank cells may be sent as '' or left out. */
const cell = z.string().max(500).optional();

/**
 * The body carries raw cells, so one bad cell does not reject the whole file: every row is checked on its
 * own (studentImportRow) and the answer lists the problems per spreadsheet line.
 */
export const importStudentsBody = z.strictObject({
  dryRun: z.boolean().default(false),
  rows: z
    .array(
      z.strictObject({
        line: z.number().int().min(1),
        email: cell,
        firstName: cell,
        lastName: cell,
        phone: cell,
        studentNumber: cell,
        admissionDate: cell,
        dateOfBirth: cell,
        gender: cell,
        address: cell,
        guardianName: cell,
        guardianPhone: cell,
        className: cell,
      }),
    )
    .min(1)
    .max(BULK_MAX_ROWS)
    .refine((rows) => new Set(rows.map((row) => row.line)).size === rows.length, {
      error: 'duplicate line in the list',
    }),
});

/** One row of a student import after blank cells were dropped: the fields of a new student account. */
export const studentImportRow = z.object({
  email,
  firstName: name,
  lastName: name,
  phone: phone.optional(),
  studentNumber: studentNumber.optional(),
  admissionDate: dateStr.optional(),
  ...studentDetailFields,
  className: shortText(50).optional(),
});
