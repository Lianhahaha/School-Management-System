import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
import { assertActiveTeacher } from '../teachers/teachers.service.js';
import * as repo from './classes.repository.js';

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

export async function createClass(body) {
  if (body.homeroomTeacherId) await assertActiveTeacher(body.homeroomTeacherId);
  return getClass(await repo.insertClass(body));
}

export async function updateClass(id, patch) {
  await getClass(id);
  if (patch.homeroomTeacherId) await assertActiveTeacher(patch.homeroomTeacherId);
  await repo.updateClass(id, patch);
  return getClass(id);
}

export async function deleteClass(id) {
  if (!(await repo.deleteClass(id))) throw ApiError.notFound('class', id);
  return { id };
}
