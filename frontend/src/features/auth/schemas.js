import { z } from 'zod';
import { GENDERS } from '../../constants/shared';
import {
  email,
  lrn,
  name,
  nullableField,
  optionalField,
  password,
  pastDateYMD,
  phone,
  requiredId,
} from '../../lib/validators';

const address = z.string().max(255, 'Use 255 characters or fewer');
const previousSchool = z.string().max(150, 'Use 150 characters or fewer');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const forgotSchema = z.object({ email });

/** What every sign-up asks: the account itself, and `confirmPassword`, which exists only in the form. */
const accountFields = {
  firstName: name,
  lastName: name,
  email,
  password,
  confirmPassword: z.string(),
  phone: optionalField(phone),
};

/**
 * The POST /auth/register body plus `confirmPassword` (remove it before sending), by `accountType`:
 *
 *   student    registering is applying: the grade applied for and the guardian are required, the previous
 *              school, the LRN and the other student details are optional; the student number is generated
 *              by the backend. Right after signing up the student picks a class of that grade.
 *   assistant  a student assistant: the account fields only (the student fields the form still holds are
 *              dropped); the account waits for the school office to approve it.
 */
export const registerSchema = z
  .discriminatedUnion('accountType', [
    z.object({
      accountType: z.literal('student'),
      ...accountFields,
      gradeLevel: requiredId('Choose the grade you are applying for'),
      previousSchool: optionalField(previousSchool),
      lrn: optionalField(lrn),
      guardianName: name,
      guardianPhone: phone,
      dateOfBirth: optionalField(pastDateYMD),
      gender: optionalField(z.enum(GENDERS)),
      address: optionalField(address),
    }),
    z.object({ accountType: z.literal('assistant'), ...accountFields }),
  ])
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords don't match",
    path: ['confirmPassword'],
  });

/** Top-level form fields, for `applyServerErrors(..., { knownFields })` (a union has no `.shape`). */
export const REGISTER_FIELDS = Object.freeze([
  'accountType',
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
  'phone',
  'gradeLevel',
  'previousSchool',
  'lrn',
  'guardianName',
  'guardianPhone',
  'dateOfBirth',
  'gender',
  'address',
]);

export const registerDefaults = {
  accountType: 'student',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  gradeLevel: '',
  previousSchool: '',
  lrn: '',
  guardianName: '',
  guardianPhone: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
};

/** The PATCH /auth/me body: a blank input clears the stored value (null). Only students may send the last three. */
export const contactSchema = z.object({
  phone: nullableField(phone),
  address: nullableField(address),
  guardianName: nullableField(name),
  guardianPhone: nullableField(phone),
});

/** Form values of the contact form for an account (null becomes '' because inputs cannot hold null). */
export function contactDefaults(me) {
  const profile = me.profile ?? {};
  return {
    phone: me.phone ?? '',
    address: profile.address ?? '',
    guardianName: profile.guardianName ?? '',
    guardianPhone: profile.guardianPhone ?? '',
  };
}
