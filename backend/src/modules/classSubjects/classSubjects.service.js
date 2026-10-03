import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { assertActiveSubject } from '../subjects/subjects.service.js';
import { assertActiveTeacher } from '../teachers/teachers.service.js';
import * as repo from './classSubjects.repository.js';

const toClassSubjectShape = (row) => ({
  id: row.id,
  ...classSubjectRef(row),
  subjectCode: row.subjectCode,
  teacher: personRef(row.teacherId, row.teacherFirstName, row.teacherLastName),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listClassSubjects(user, listQuery) {
  await access.assertFiltersInScope(user, listQuery);
  const query = { ...listQuery, teacherId: resolveMe(user, listQuery.teacherId, 'teacher') };
  const { rows, meta } = await repo.listClassSubjects(query, access.classScope(user, 'cs.class_id'));
  return { data: rows.map(toClassSubjectShape), meta };
}

export async function getClassSubject(user, id) {
  await access.assertCanViewClassSubject(user, id);
  return toClassSubjectShape(ApiError.assertFound(await repo.findClassSubjectById(id), 'class subject', id));
}

/** Unscoped reference `{ classId, className, ... teacherId }` for other modules that already did their own access check. */
export async function getClassSubjectRef(id) {
  return classSubjectRef(ApiError.assertFound(await repo.findClassSubjectById(id), 'class subject', id));
}

export async function createClassSubject(body) {
  await assertActiveTeacher(body.teacherId);
  await assertActiveSubject(body.subjectId);
  const id = await repo.insertClassSubject(body);
  return toClassSubjectShape(await repo.findClassSubjectById(id));
}

export async function reassignTeacher(id, teacherId) {
  ApiError.assertFound(await repo.findClassSubjectById(id), 'class subject', id);
  await assertActiveTeacher(teacherId);
  await repo.updateTeacher(id, teacherId);
  return toClassSubjectShape(await repo.findClassSubjectById(id));
}

export async function deleteClassSubject(id) {
  if (!(await repo.deleteClassSubject(id))) throw ApiError.notFound('class subject', id);
  return { id };
}

export const teacherHasAssignments = repo.teacherHasAssignments;
