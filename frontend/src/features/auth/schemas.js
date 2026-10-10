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

/**
 * The POST /auth/register body plus `confirmPassword`, which exists only in the form (remove it
 * before sending). Registering is applying: the grade applied for and the guardian are required, the
 * previous school, the LRN and the other student details are optional; the student number is generated
 * by the backend.
 */
export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    password,
    confirmPassword: z.string(),
    gradeLevel: requiredId('Choose the grade you are applying for'),
    previousSchool: optionalField(previousSchool),
    lrn: optionalField(lrn),
    guardianName: name,
    guardianPhone: phone,
    phone: optionalField(phone),
    dateOfBirth: optionalField(pastDateYMD),
    gender: optionalField(z.enum(GENDERS)),
    address: optionalField(address),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const registerDefaults = {
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
