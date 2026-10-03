import { z } from 'zod';
import { requiredId } from '../../lib/validators';

/**
 * "Add subject" form of a class. `classId` is not a field: the modal knows the class and sends
 * `{ classId, ...values }` to useCreateClassSubject.
 */
export const addClassSubjectSchema = z.object({
  subjectId: requiredId('Choose a subject'),
  teacherId: requiredId('Choose a teacher'),
});

/** "Change teacher" form: PATCH /class-subjects/:id sends `{ teacherId }`. */
export const reassignClassSubjectSchema = z.object({ teacherId: requiredId('Choose a teacher') });

/** Form values: the current teacher is preselected when changing it. */
export const classSubjectDefaults = (classSubject) => ({
  subjectId: '',
  teacherId: classSubject ? String(classSubject.teacherId) : '',
});
