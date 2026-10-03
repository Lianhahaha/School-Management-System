import { z } from 'zod';
import {
  dateYMD,
  employeeNumber as employeeNumberField,
  name,
  nullableField,
  phone,
} from '../../lib/validators';

/**
 * PATCH /teachers/:id. Blank optional inputs become null (the stored value is cleared). Send only
 * the changed fields: `changedFields(values, formState.dirtyFields)` from utils/forms.js.
 */
export const updateTeacherSchema = z.object({
  firstName: name,
  lastName: name,
  phone: nullableField(phone),
  employeeNumber: employeeNumberField,
  hireDate: dateYMD,
  department: nullableField(z.string().max(100, 'Use 100 characters or fewer')),
  qualification: nullableField(z.string().max(150, 'Use 150 characters or fewer')),
});

/** Form values for a teacher row (null becomes '' because inputs cannot hold null). */
export const teacherDefaults = (teacher) => ({
  firstName: teacher.firstName,
  lastName: teacher.lastName,
  phone: teacher.phone ?? '',
  employeeNumber: teacher.employeeNumber,
  hireDate: teacher.hireDate,
  department: teacher.department ?? '',
  qualification: teacher.qualification ?? '',
});
