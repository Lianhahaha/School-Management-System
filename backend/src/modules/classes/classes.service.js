import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
import { assertActiveTeacher } from '../teachers/teachers.service.js';
import * as repo from './classes.repository.js';

/** Fields that place the class's enrollments, assignments and timetable in a year and grade. */
const FIXED_ONCE_IN_USE = ['academicYear', 'gradeLevel'];

export const toClassShape = (row) => ({
  id: row.id,
  name: row.name,
  gradeLevel: row.gradeLevel,
  academicYear: row.academicYear,
  homeroomTeacher: personRef(row.homeroomTeacherId, row.homeroomFirstName, row.homeroomLastName),
  studentCount: row.studentCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listClasses(user, listQuery) {
  const query = { ...listQuery, homeroomTeacherId: resolveMe(user, listQuery.homeroomTeacherId, 'teacher') };
  const { rows, meta } = await repo.listClasses(query);
  return { data: rows.map(toClassShape), meta };
}

export async function getClass(id) {
  return toClassShape(ApiError.assertFound(await repo.findClassById(id), 'class', id));
}

/** 400 unless the class exists and belongs to the current or a future academic year (past rosters are history). */
export async function assertEnrollableClass(classId, conn) {
  const klass = await repo.findClassById(classId, conn);
  if (!klass) {
    throw ApiError.validation('class does not exist', undefined, {
      reason: 'invalid_reference',
      field: 'classId',
    });
  }
  if (klass.academicYear < currentAcademicYear()) {
    throw ApiError.validation(`class belongs to the past academic year ${klass.academicYear}`, undefined, {
      reason: 'past_academic_year',
      field: 'classId',
      academicYear: klass.academicYear,
    });
  }
}

export async function createClass(body) {
  if (body.homeroomTeacherId) await assertActiveTeacher(body.homeroomTeacherId);
  return getClass(await repo.insertClass(body));
}

export async function updateClass(id, patch) {
  const existing = await getClass(id);
  const fixedFields = FIXED_ONCE_IN_USE.filter((field) => field in patch && patch[field] !== existing[field]);
  if (fixedFields.length && (await repo.classHasDependents(id))) {
    throw ApiError.conflict('academic year and grade level are fixed while the class is in use', {
      reason: 'class_in_use',
      fields: fixedFields,
    });
  }
  if (patch.homeroomTeacherId) await assertActiveTeacher(patch.homeroomTeacherId);
  await repo.updateClass(id, patch);
  return getClass(id);
}

export async function deleteClass(id) {
  if (!(await repo.deleteClass(id))) throw ApiError.notFound('class', id);
  return { id };
}
