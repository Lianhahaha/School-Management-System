/**
 * The subject catalogue, with each subject's grade weights: how much every assessment type counts towards
 * a result in the subject (`gradeWeights`, type -> percent), or null when the subject is graded on points.
 */
import { withTransaction } from '../../config/db.js';
import { ASSESSMENT_TYPES } from '../../constants/shared.js';
import { ApiError } from '../../utils/ApiError.js';
import { changedList, changesOf, record } from '../activity/activity.service.js';
import * as repo from './subjects.repository.js';

/** Map subjectId -> weights of every assessment type (0 when not weighted), for the subjects that have rows. */
function weightsBySubject(rows) {
  const bySubject = new Map();
  for (const row of rows) {
    if (!bySubject.has(row.subjectId)) {
      bySubject.set(row.subjectId, Object.fromEntries(ASSESSMENT_TYPES.map((type) => [type, 0])));
    }
    bySubject.get(row.subjectId)[row.assessmentType] = row.weight;
  }
  return bySubject;
}

/** Map subjectId -> weights of every assessment type (0 when not weighted), or null for a subject on points. */
export async function gradeWeightsBySubject(subjectIds, conn) {
  const bySubject = weightsBySubject(await repo.findGradeWeights([...new Set(subjectIds)], conn));
  return new Map(subjectIds.map((id) => [id, bySubject.get(id) ?? null]));
}

/**
 * The weights of every weighted subject (a subject missing from the map is on points). The table is small, so
 * a grade summary reads it at the same time as the grades instead of after them.
 */
export async function allGradeWeights() {
  return weightsBySubject(await repo.findGradeWeights(null));
}

async function withGradeWeights(rows, conn) {
  const weights = await gradeWeightsBySubject(
    rows.map((row) => row.id),
    conn,
  );
  return rows.map((row) => ({ ...row, gradeWeights: weights.get(row.id) }));
}

export async function listSubjects(listQuery) {
  const { rows, meta } = await repo.listSubjects(listQuery);
  return { data: await withGradeWeights(rows), meta };
}

export async function getSubject(id, conn) {
  const row = ApiError.assertFound(await repo.findSubjectById(id, conn), 'subject', id);
  return (await withGradeWeights([row], conn))[0];
}

export async function createSubject({ gradeWeights, ...body }) {
  const id = await withTransaction(async (conn) => {
    const subjectId = await repo.insertSubject(body, conn);
    if (gradeWeights) await repo.replaceGradeWeights(subjectId, gradeWeights, conn);
    return subjectId;
  });
  const subject = await getSubject(id);
  await record({
    action: 'subject.create',
    entityId: id,
    summary: `Created the subject ${subject.code} · ${subject.name}`,
    details: { code: subject.code, name: subject.name, gradeWeights: subject.gradeWeights },
  });
  return subject;
}

/** `gradeWeights` replaces the subject's weights; null puts it back on points. */
export async function updateSubject(id, patch) {
  const before = await getSubject(id);
  await withTransaction(async (conn) => {
    await repo.updateSubject(id, patch, conn);
    if ('gradeWeights' in patch) await repo.replaceGradeWeights(id, patch.gradeWeights, conn);
  });
  const subject = await getSubject(id);
  // Compared on the stored values, so weights sent with zeros left out still match.
  const changes = changesOf(
    before,
    Object.fromEntries(Object.keys(patch).map((field) => [field, subject[field]])),
  );
  if (changes) {
    const retired = 'isActive' in changes && Object.keys(changes).length === 1;
    await record({
      action: 'subject.update',
      entityId: id,
      summary: retired
        ? `${subject.isActive ? 'Reactivated' : 'Retired'} the subject ${subject.code} · ${subject.name}`
        : `Updated the ${changedList(changes)} of the subject ${subject.code} · ${subject.name}`,
      details: { code: subject.code, changes },
    });
  }
  return subject;
}

/**
 * Hard delete only when nothing references the subject (the FK answers 409 otherwise, and the transaction puts
 * its weights back); retire it with isActive=false.
 */
export async function deleteSubject(id) {
  const subject = await repo.findSubjectById(id);
  await withTransaction(async (conn) => {
    await repo.replaceGradeWeights(id, null, conn);
    if (!(await repo.deleteSubject(id, conn))) throw ApiError.notFound('subject', id);
  });
  await record({
    action: 'subject.delete',
    entityId: id,
    summary: `Deleted the subject ${subject.code} · ${subject.name}`,
    details: { code: subject.code, name: subject.name },
  });
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
