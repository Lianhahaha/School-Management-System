import { z } from 'zod';
import { PAYMENT_METHODS } from '../../constants/shared';
import { dateYMD, optionalField } from '../../lib/validators';
import { todayYmd } from '../../utils/date';

/** Pesos and centavos as the API takes them: above zero, at most two decimals, within DECIMAL(10,2). */
const amount = z.coerce
  .number({ error: 'Enter an amount' })
  .positive('Enter an amount above ₱0')
  .max(99_999_999.99, 'Enter an amount below ₱100,000,000')
  .multipleOf(0.01, 'Use at most two decimals');

/** A fee, for the year shown on the Fees page. The grade select's empty choice is "All grades" (null). */
export const feeSchema = z.object({
  name: z.string().trim().min(1, 'This field is required').max(100, 'Use 100 characters or fewer'),
  gradeLevel: z.string().transform((value) => (value === '' ? null : Number(value))),
  amount,
});

/** Form values; call without a fee for the create form. */
export const feeDefaults = (fee) => ({
  name: fee?.name ?? '',
  gradeLevel: fee?.gradeLevel ? String(fee.gradeLevel) : '',
  amount: fee ? String(fee.amount) : '',
});

/** POST /payments without the student and the year, which the statement supplies. */
export const paymentSchema = z.object({
  amount,
  paidOn: dateYMD.refine((value) => value <= todayYmd(), 'The date cannot be in the future'),
  method: z.enum(PAYMENT_METHODS, { error: 'Choose how it was paid' }),
  receiptNumber: z.string().trim().min(1, 'This field is required').max(30, 'Use 30 characters or fewer'),
  note: optionalField(z.string().max(255, 'Use 255 characters or fewer')),
});

/** A new payment: paid today, in cash. */
export const paymentDefaults = () => ({
  amount: '',
  paidOn: todayYmd(),
  method: 'cash',
  receiptNumber: '',
  note: '',
});
