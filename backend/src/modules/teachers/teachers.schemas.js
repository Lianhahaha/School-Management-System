import {
  boolQuery,
  dateStr,
  employeeNumber,
  idOrMeParams,
  idParams,
  listQuery,
  name,
  patchOf,
  phone,
  shortText,
} from '../../utils/zod/common.js';
import { TEACHER_SORT_MAP } from './teachers.repository.js';

export const listTeachersQuery = listQuery(Object.keys(TEACHER_SORT_MAP), {
  department: shortText(100).min(1).optional(),
  isActive: boolQuery.optional(),
});

export const updateTeacherBody = patchOf({
  firstName: name,
  lastName: name,
  phone: phone.nullable(),
  employeeNumber,
  hireDate: dateStr,
  department: shortText(100).nullable(),
  qualification: shortText(150).nullable(),
});

export { idOrMeParams, idParams };
