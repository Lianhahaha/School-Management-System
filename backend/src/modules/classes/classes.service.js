import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { personRef } from '../../utils/shapes.js';
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
  if (patch.homeroomTeacherId) await assertActiveTeacher(patch.homeroomTeacherId);
  await repo.updateClass(id, patch);
  const klass = await getClass(id);
  const changes = changesOf(logView(existing), logView(klass));
  if (changes) {
    await record({
      action: 'class.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of ${klass.name}, ${klass.academicYear}`,
      details: { changes },
    });
    if (changes.homeroomTeacher && klass.homeroomTeacher) {
      await notifyTeacher(klass.homeroomTeacher.id, homeroomNote(klass));
    }
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
  const klass = await repo.findClassById(id);
  if (!(await repo.deleteClass(id))) throw ApiError.notFound('class', id);
  await record({
    action: 'class.delete',
    entityId: id,
    summary: `Deleted the class ${klass.name}, ${klass.academicYear}`,
    details: { name: klass.name, academicYear: klass.academicYear },
  });
  return { id };
}
