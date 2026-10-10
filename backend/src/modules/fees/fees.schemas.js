import { z } from 'zod';
import { PAYMENT_METHODS } from '../../constants/shared.js';
import { todayYmd } from '../../utils/dates.js';
import {
  academicYear,
  dateStr,
  gradeLevel,
  id,
  idOrMe,
  idParams,
  listQuery,
  optionalText,
  patchOf,
  shortText,
} from '../../utils/zod/common.js';
import { FEE_SORT_MAP } from './fees.repository.js';

/** Pesos and centavos: above zero, at most two decimals, within the DECIMAL(10,2) columns. */
const amount = z.number().positive().multipleOf(0.01).max(99_999_999.99);

const feeName = shortText(100).min(1, { error: 'required' });

/** `gradeLevel` lists the fees a student of that grade pays: that grade's and the every-grade ones. */
export const listFeesQuery = listQuery(
  Object.keys(FEE_SORT_MAP),
  { academicYear: academicYear.optional(), gradeLevel: gradeLevel.optional() },
  { searchable: false },
);

/** `gradeLevel` null or left out: the fee applies to every grade. */
export const createFeeBody = z.strictObject({
  academicYear,
  gradeLevel: gradeLevel.nullable().optional(),
  name: feeName,
  amount,
});

export const updateFeeBody = patchOf({
  academicYear,
  gradeLevel: gradeLevel.nullable(),
  name: feeName,
  amount,
});

/** `studentId` may be `me` (a student reads only their own statement). */
export const statementQuery = z.strictObject({ studentId: idOrMe, academicYear });

export const createPaymentBody = z.strictObject({
  studentId: id,
  academicYear,
  amount,
  paidOn: dateStr.refine((value) => value <= todayYmd(), { error: 'must not be in the future' }),
  method: z.enum(PAYMENT_METHODS),
  receiptNumber: shortText(30).min(1, { error: 'required' }),
  note: optionalText(255).optional(),
});

export { idParams };
