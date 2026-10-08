import { z } from 'zod';
import {
  academicYear,
  boolQuery,
  gradeLevel,
  id,
  idOrMe,
  idParams,
  listQuery,
  patchOf,
  shortText,
} from '../../utils/zod/common.js';
import { CLASS_SORT_MAP } from './classes.repository.js';

const name = shortText(50).min(1, { error: 'required' }); // classes.name is VARCHAR(50)

export const listClassesQuery = listQuery(Object.keys(CLASS_SORT_MAP), {
  academicYear: academicYear.optional(),
  gradeLevel: gradeLevel.optional(),
  homeroomTeacherId: idOrMe.optional(),
  // Only the classes the caller can see (a teacher's taught and homeroom classes, a student's class).
  visible: boolQuery.optional(),
});

export const createClassBody = z.strictObject({
  name,
  gradeLevel,
  academicYear,
  homeroomTeacherId: id.nullable().optional(),
});

export const updateClassBody = patchOf({ name, gradeLevel, academicYear, homeroomTeacherId: id.nullable() });

export { idParams };
