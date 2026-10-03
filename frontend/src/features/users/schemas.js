/**
 * Forms of the users feature. zodResolver hands the *parsed* values to the submit handler, and the
 * parsed values are exactly the request body: blank optional inputs are left out (POST) or sent as
 * null (PATCH), numbers are numbers, and the `profile` of an admin is dropped.
 */
import { z } from 'zod';
import { GENDERS } from '../../constants/shared';
import {
  dateYMD,
  email,
  employeeNumber,
  name,
  nullableField,
  optionalField,
  password,
  pastDateYMD,
  phone,
  studentNumber,
} from '../../lib/validators';

const text = (max) => z.string().max(max, `Use ${max} characters or fewer`);

const studentProfile = z.object({
  studentNumber: optionalField(studentNumber),
  admissionDate: optionalField(dateYMD),
  dateOfBirth: optionalField(pastDateYMD),
  gender: optionalField(z.enum(GENDERS)),
  address: optionalField(text(255)),
  guardianName: optionalField(name),
  guardianPhone: optionalField(phone),
});

const teacherProfile = z.object({
  employeeNumber: optionalField(employeeNumber),
  hireDate: optionalField(dateYMD),
  department: optionalField(text(100)),
  qualification: optionalField(text(150)),
});

const account = {
  firstName: name,
  lastName: name,
  email,
  password,
  phone: optionalField(phone),
};

/** POST /users body. The `profile` section follows the role; an admin has none. */
export const createUserSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('student'), ...account, profile: studentProfile }),
  z.object({ role: z.literal('teacher'), ...account, profile: teacherProfile }),
  z.object({ role: z.literal('admin'), ...account }),
]);

/** Top-level form fields, for `applyServerErrors(..., { knownFields })` (a union has no `.shape`). */
export const CREATE_USER_FIELDS = ['role', 'firstName', 'lastName', 'email', 'password', 'phone', 'profile'];

/** Unique-key conflicts name `studentNumber` / `employeeNumber`; in this form they live under `profile`. */
export const CREATE_USER_FIELD_MAP = {
  studentNumber: 'profile.studentNumber',
  employeeNumber: 'profile.employeeNumber',
};

/** Blank form values for every section; the role decides which ones the schema keeps. */
export const createUserDefaults = (role = 'student') => ({
  role,
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  profile: {
    studentNumber: '',
    admissionDate: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    guardianName: '',
    guardianPhone: '',
    employeeNumber: '',
    hireDate: '',
    department: '',
    qualification: '',
  },
});

/** PATCH /users/:id body: email and role are immutable and not part of the form. */
export const updateUserSchema = z.object({
  firstName: name,
  lastName: name,
  phone: nullableField(phone),
});

export const updateUserDefaults = (user) => ({
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone ?? '',
});
