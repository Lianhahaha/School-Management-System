import { z } from 'zod';
import { ADMISSION_STATUSES, GENDERS } from '../../constants/shared.js';
import {
  boolQuery,
  dateStr,
  gradeLevel,
  id,
  idOrMeParams,
  idParams,
  listQuery,
  lrn,
  name,
  pastDate,
  patchOf,
  phone,
  optionalText,
  studentNumber,
} from '../../utils/zod/common.js';
import { STUDENT_SORT_MAP } from './students.repository.js';

export const listStudentsQuery = listQuery(Object.keys(STUDENT_SORT_MAP), {
  classId: id.optional(),
  gradeLevel: gradeLevel.optional(),
  gender: z.enum(GENDERS).optional(),
  isActive: boolQuery.optional(),
  // false: students without a class an admin still has to place (pending and declined applicants are left out).
  hasActiveEnrollment: boolQuery.optional(),
  admissionStatus: z.enum(ADMISSION_STATUSES).optional(),
});

export const updateStudentBody = patchOf({
  firstName: name,
  lastName: name,
  phone: phone.nullable(),
  studentNumber,
  lrn: lrn.nullable(),
  dateOfBirth: pastDate.nullable(),
  gender: z.enum(GENDERS).nullable(),
  address: optionalText(255).nullable(),
  guardianName: name.nullable(),
  guardianPhone: phone.nullable(),
  admissionDate: dateStr,
});

export { idOrMeParams, idParams };
