import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import { notifyTeacher } from '../notifications/notifications.service.js';
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

/**
 * The class list is reference data every role may read (names, years, homeroom teacher, head count). With
 * `visible=true` it is limited to the caller's own classes, so a teacher's class picker never has to filter
 * a page of the whole school.
 */
export async function listClasses(user, listQuery) {
  const query = { ...listQuery, homeroomTeacherId: resolveMe(user, listQuery.homeroomTeacherId, 'teacher') };
  const scope = listQuery.visible ? access.classScope(user, 'c.id') : null;
  const { rows, meta } = await repo.listClasses(query, scope);
  return { data: rows.map(toClassShape), meta };
}

/** The sections of one grade level in one academic year (reference data, no access check). */
export async function classesOfGrade(academicYear, gradeLevel) {
  return (await repo.findClassesOfGrade(academicYear, gradeLevel)).map(toClassShape);
}

export async function getClass(id) {
  return toClassShape(ApiError.assertFound(await repo.findClassById(id), 'class', id));
}

/**
 * The class a request body refers to in `field`; 400 invalid_reference when it does not exist.
 * `options.forUpdate` locks the class row until the caller's transaction ends.
 */
export async function findReferencedClass(classId, field, conn, options) {
  const klass = await repo.findClassById(classId, conn, options);
  if (!klass) {
    throw ApiError.validation('class does not exist', undefined, { reason: 'invalid_reference', field });
  }
  return klass;
}

/**
 * The class, unless it does not exist or belongs to a past academic year (past rosters are history): 400.
 * `field` names the body field the class came from.
 */
export async function assertEnrollableClass(classId, conn, field = 'classId') {
  const klass = await findReferencedClass(classId, field, conn);
  if (klass.academicYear < currentAcademicYear()) {
    throw ApiError.validation(`class belongs to the past academic year ${klass.academicYear}`, undefined, {
      reason: 'past_academic_year',
      field,
      academicYear: klass.academicYear,
    });
  }
  return klass;
}

export async function createClass(body) {
  if (body.homeroomTeacherId) await assertActiveTeacher(body.homeroomTeacherId);
  const klass = await getClass(await repo.insertClass(body));
  await record({
    action: 'class.create',
    entityId: klass.id,
    summary: `Created the class ${klass.name}, ${klass.academicYear}`,
    details: { name: klass.name, gradeLevel: klass.gradeLevel, academicYear: klass.academicYear },
  });
  if (klass.homeroomTeacher) await notifyTeacher(klass.homeroomTeacher.id, homeroomNote(klass));
  return klass;
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
  const homeroomChanged =
    'homeroomTeacherId' in patch && patch.homeroomTeacherId !== (existing.homeroomTeacher?.id ?? null);
  // Only a new homeroom teacher must be active: keeping a since-deactivated one on an old class is allowed.
  if (homeroomChanged && patch.homeroomTeacherId) await assertActiveTeacher(patch.homeroomTeacherId);
  await repo.updateClass(id, patch);
  const klass = await getClass(id);
  const before = logView(existing);
  const after = logView(klass);
  const changes = changesOf(before, after) ?? (homeroomChanged ? {} : null);
  // Two teachers can share a name: a homeroom change is logged even when the names read the same.
  if (homeroomChanged && !changes.homeroomTeacher) {
    changes.homeroomTeacher = { from: before.homeroomTeacher, to: after.homeroomTeacher };
  }
  if (changes) {
    await record({
      action: 'class.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of ${klass.name}, ${klass.academicYear}`,
      details: { changes },
    });
  }
  // By id: two teachers may share a name, and the new one must still hear about the class.
  if (homeroomChanged && klass.homeroomTeacher) {
    await notifyTeacher(klass.homeroomTeacher.id, homeroomNote(klass));
  }
  return klass;
}

/** The note a teacher gets when a class becomes theirs as homeroom teacher. */
const homeroomNote = (klass) => ({
  type: 'teaching',
  title: `You are now the homeroom teacher of ${klass.name}`,
  body: klass.academicYear,
  link: '/teacher/classes',
});

/** The fields of a class the activity log compares, the homeroom teacher by name. */
const logView = (klass) => ({
  name: klass.name,
  gradeLevel: klass.gradeLevel,
  academicYear: klass.academicYear,
  homeroomTeacher: klass.homeroomTeacher ? nameOf(klass.homeroomTeacher) : null,
});

export async function deleteClass(id) {
  const klass = ApiError.assertFound(await repo.findClassById(id), 'class', id);
  if (!(await repo.deleteClass(id))) throw ApiError.notFound('class', id);
  await record({
    action: 'class.delete',
    entityId: id,
    summary: `Deleted the class ${klass.name}, ${klass.academicYear}`,
    details: { name: klass.name, academicYear: klass.academicYear },
  });
  return { id };
}
