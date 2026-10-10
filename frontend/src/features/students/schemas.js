import { z } from 'zod';
import { GENDERS } from '../../constants/shared';
import {
  dateYMD,
  lrn,
  name,
  nullableField,
  pastDateYMD,
  phone,
  studentNumber as studentNumberField,
} from '../../lib/validators';

/**
 * PATCH /students/:id. Blank optional inputs become null (the stored value is cleared). Send only
 * the changed fields: `changedFields(values, formState.dirtyFields)` from utils/forms.js.
 */
export const updateStudentSchema = z.object({
  firstName: name,
  lastName: name,
  phone: nullableField(phone),
  studentNumber: studentNumberField,
  lrn: nullableField(lrn),
  dateOfBirth: nullableField(pastDateYMD), // the API refuses a date of birth that is not in the past
  gender: nullableField(z.enum(GENDERS)),
  address: nullableField(z.string().max(255, 'Use 255 characters or fewer')),
  guardianName: nullableField(name),
  guardianPhone: nullableField(phone),
  admissionDate: dateYMD,
});

/** Form values for a student row (null becomes '' because inputs cannot hold null). */
export const studentDefaults = (student) => ({
  firstName: student.firstName,
  lastName: student.lastName,
  phone: student.phone ?? '',
  studentNumber: student.studentNumber,
  lrn: student.lrn ?? '',
  dateOfBirth: student.dateOfBirth ?? '',
  gender: student.gender ?? '',
  address: student.address ?? '',
  guardianName: student.guardianName ?? '',
  guardianPhone: student.guardianPhone ?? '',
  admissionDate: student.admissionDate,
});
