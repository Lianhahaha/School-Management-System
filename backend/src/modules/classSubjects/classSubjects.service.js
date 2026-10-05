import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyTeacher } from '../notifications/notifications.service.js';
import { writeIfTeacherFree } from '../schedules/schedules.service.js';
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
export async function getClassSubjectRefUnscoped(id) {
  return classSubjectRef(ApiError.assertFound(await repo.findClassSubjectById(id), 'class subject', id));
}

export async function createClassSubject(body) {
  await assertActiveTeacher(body.teacherId);
  await assertActiveSubject(body.subjectId);
  const id = await repo.insertClassSubject(body);
  const assignment = toClassSubjectShape(await repo.findClassSubjectById(id));
  await record({
    action: 'assignment.create',
    entityId: id,
    summary: `Assigned ${nameOf(assignment.teacher)} to teach ${assignment.subjectName} in ${assignment.className}`,
    details: lessonOf(assignment),
  });
  await notifyTeacher(assignment.teacherId, teachingNote(assignment));
  return assignment;
}

/** The note a teacher gets when a lesson is given to them. */
const teachingNote = (assignment) => ({
  type: 'teaching',
  title: `You now teach ${assignment.subjectName} in ${assignment.className}`,
  body: assignment.academicYear,
  link: '/teacher/classes',
});

/** Names of a class-subject for the activity log. */
const lessonOf = (assignment) => ({
  className: assignment.className,
  academicYear: assignment.academicYear,
  subjectName: assignment.subjectName,
  teacher: nameOf(assignment.teacher),
});

/** The new teacher takes over the timetable slots, so a clash with their other lessons is a 409. */
export async function reassignTeacher(id, teacherId) {
  const before = toClassSubjectShape(
    ApiError.assertFound(await repo.findClassSubjectById(id), 'class subject', id),
  );
  await assertActiveTeacher(teacherId);
  await writeIfTeacherFree(id, teacherId, (conn) => repo.updateTeacher(id, teacherId, conn));
  const assignment = toClassSubjectShape(await repo.findClassSubjectById(id));
  if (before.teacherId !== assignment.teacherId) {
    await record({
      action: 'assignment.reassign',
      entityId: id,
      summary: `${assignment.subjectName} in ${assignment.className}: ${nameOf(before.teacher)} replaced by ${nameOf(assignment.teacher)}`,
      details: { ...lessonOf(assignment), previousTeacher: nameOf(before.teacher) },
    });
    await notifyTeacher(assignment.teacherId, teachingNote(assignment));
  }
  return assignment;
}

export async function deleteClassSubject(id) {
  const row = await repo.findClassSubjectById(id);
  if (!(await repo.deleteClassSubject(id))) throw ApiError.notFound('class subject', id);
  const assignment = toClassSubjectShape(row);
  await record({
    action: 'assignment.delete',
    entityId: id,
    summary: `Removed ${assignment.subjectName} (${nameOf(assignment.teacher)}) from ${assignment.className}`,
    details: lessonOf(assignment),
  });
  return { id };
}

export const teacherHasAssignments = repo.teacherHasAssignments;
