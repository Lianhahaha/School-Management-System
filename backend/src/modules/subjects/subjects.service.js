import { ApiError } from '../../utils/ApiError.js';
import * as repo from './subjects.repository.js';

export async function listSubjects(listQuery) {
  const { rows, meta } = await repo.listSubjects(listQuery);
  return { data: rows, meta };
}

export async function getSubject(id) {
  return ApiError.assertFound(await repo.findSubjectById(id), 'subject', id);
}

export async function createSubject(body) {
  return repo.findSubjectById(await repo.insertSubject(body));
}

export async function updateSubject(id, patch) {
  await getSubject(id);
  await repo.updateSubject(id, patch);
  return repo.findSubjectById(id);
}

/** Hard delete only when nothing references the subject (the FK answers 409 otherwise); retire it with isActive=false. */
export async function deleteSubject(id) {
  if (!(await repo.deleteSubject(id))) throw ApiError.notFound('subject', id);
  return { id };
}

/** 400 when the subject does not exist or has been retired (used before assigning it to a class). */
export async function assertActiveSubject(subjectId) {
  const subject = await repo.findSubjectById(subjectId);
  if (!subject) {
    throw ApiError.validation('subject does not exist', undefined, {
      reason: 'invalid_reference',
      field: 'subjectId',
    });
  }
  if (!subject.isActive) {
    throw ApiError.validation('subject is retired', undefined, {
      reason: 'subject_inactive',
      field: 'subjectId',
    });
  }
}
