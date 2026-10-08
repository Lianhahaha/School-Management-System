/**
 * Field groups shared by several schemas, so a student's contact details or an
 * account's identity fields are defined once.
 */
import { z } from 'zod';
import { GENDERS } from '../../constants/shared.js';
import {
  dateStr,
  email,
  employeeNumber,
  name,
  password,
  pastDate,
  phone,
  optionalText,
  studentNumber,
} from './common.js';

/** Identity fields needed to create any account. */
export const accountFields = {
  email,
  password,
  firstName: name,
  lastName: name,
  phone: phone.optional(),
};

/** Optional personal details of a student (public registration and admin-created students). */
export const studentDetailFields = {
  dateOfBirth: pastDate.optional(),
  gender: z.enum(GENDERS).optional(),
  address: optionalText(255).optional(),
  guardianName: name.optional(),
  guardianPhone: phone.optional(),
};

/** `profile` object of POST /users for role student (every field optional; numbers are generated). */
export const studentProfileInput = z.strictObject({
  studentNumber: studentNumber.optional(),
  admissionDate: dateStr.optional(),
  ...studentDetailFields,
});

/** `profile` object of POST /users for role teacher (every field optional; numbers are generated). */
export const teacherProfileInput = z.strictObject({
  employeeNumber: employeeNumber.optional(),
  hireDate: dateStr.optional(),
  department: optionalText(100).optional(),
  qualification: optionalText(150).optional(),
});
