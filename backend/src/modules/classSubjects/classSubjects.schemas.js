import { z } from 'zod';
import { academicYear, id, idOrMe, idParams, listQuery } from '../../utils/zod/common.js';
import { CLASS_SUBJECT_SORT_MAP } from './classSubjects.repository.js';

export const listClassSubjectsQuery = listQuery(Object.keys(CLASS_SUBJECT_SORT_MAP), {
  classId: id.optional(),
  subjectId: id.optional(),
  teacherId: idOrMe.optional(),
  academicYear: academicYear.optional(),
});

export const createClassSubjectBody = z.strictObject({ classId: id, subjectId: id, teacherId: id });

/** Only the teacher can be reassigned; changing class or subject means delete + create. */
export const reassignBody = z.strictObject({ teacherId: id });

export { idParams };
