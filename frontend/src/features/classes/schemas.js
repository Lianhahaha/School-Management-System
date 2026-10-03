import { z } from 'zod';
import { academicYear, nullableField, optionalField, positiveInt } from '../../lib/validators';
import { currentAcademicYear } from '../../utils/date';

/** Both forms share these fields; only the meaning of a blank homeroom teacher differs (see `blank`). */
const classShape = (blank) => ({
  name: z.string().trim().min(1, 'This field is required').max(50, 'Use 50 characters or fewer'),
  gradeLevel: z
    .string()
    .min(1, 'Choose a grade level')
    .pipe(positiveInt.max(12, 'Choose a grade from 1 to 12')),
  academicYear,
  homeroomTeacherId: blank(positiveInt),
});

/** POST /classes: no homeroom teacher selected means the key is left out. */
export const createClassSchema = z.object(classShape(optionalField));

/** PATCH /classes/:id: clearing the homeroom teacher sends null. */
export const updateClassSchema = z.object(classShape(nullableField));

/** Form values; call without an argument for the create form (current academic year preselected). */
export const classDefaults = (schoolClass) => ({
  name: schoolClass?.name ?? '',
  gradeLevel: schoolClass ? String(schoolClass.gradeLevel) : '',
  academicYear: schoolClass?.academicYear ?? currentAcademicYear(),
  homeroomTeacherId: schoolClass?.homeroomTeacher ? String(schoolClass.homeroomTeacher.id) : '',
});
