import { z } from 'zod';
import { GENDERS } from '../../constants/shared.js';
import {
  boolQuery,
  dateStr,
  gradeLevel,
  id,
  idOrMeParams,
  idParams,
  listQuery,
  name,
  pastDate,
  patchOf,
  phone,
  shortText,
  studentNumber,
} from '../../utils/zod/common.js';
import { STUDENT_SORT_MAP } from './students.repository.js';

export const listStudentsQuery = listQuery(Object.keys(STUDENT_SORT_MAP), {
  classId: id.optional(),
  gradeLevel: gradeLevel.optional(),
  gender: z.enum(GENDERS).optional(),
  isActive: boolQuery.optional(),
  hasActiveEnrollment: boolQuery.optional(),
});

export const updateStudentBody = patchOf({
  firstName: name,
  lastName: name,
  phone: phone.nullable(),
  studentNumber,
  dateOfBirth: pastDate.nullable(),
  gender: z.enum(GENDERS).nullable(),
  address: shortText(255).nullable(),
  guardianName: name.nullable(),
  guardianPhone: phone.nullable(),
  admissionDate: dateStr,
});

export { idOrMeParams, idParams };
