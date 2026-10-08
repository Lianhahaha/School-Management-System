import { withLockedTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, record } from '../activity/activity.service.js';
import * as repo from './schedules.repository.js';

const toScheduleShape = (row) => ({
  id: row.id,
  classSubjectId: row.classSubjectId,
  classSubject: {
    ...classSubjectRef(row),
    subjectCode: row.subjectCode,
    teacher: personRef(row.teacherId, row.teacherFirstName, row.teacherLastName),
  },
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  room: row.room,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** A `details.conflicts` entry: the existing slot that clashes, and the resource (`type`) it shares. */
const toConflict = (type, row) => ({
  type,
  scheduleId: row.scheduleId,
  classSubjectId: row.classSubjectId,
  className: row.className,
  subjectName: row.subjectName,
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  room: row.room,
});

/** One entry per (overlapping slot, shared resource): the class, the teacher or the room. */
const toConflicts = (rows) =>
  rows.flatMap((row) =>
    [
      ['class', row.sameClass],
      ['teacher', row.sameTeacher],
      ['room', row.sameRoom],
    ]
      .filter(([, shared]) => shared)
      .map(([type]) => toConflict(type, row)),
  );

/**
 * Runs `work(conn)` in a transaction while holding the named timetable lock, so two timetable edits cannot
 * both pass their conflict checks. The lock is released only after the transaction commits or rolls back,
 * so a second writer always sees the first writer's committed slot.
 */
function withTimetableLock(work) {
  const acquire = async (conn) => {
    if (!(await repo.acquireTimetableLock(conn))) throw ApiError.unavailable('timetable');
  };
  return withLockedTransaction(acquire, repo.releaseTimetableLock, work);
}

/**
 * Runs `write(conn)` once the slot is proven free of class, teacher and room clashes. `getSlot(conn)` builds
 * the slot inside the lock, so an edit is checked against the row as it is now, not as it was before a
 * concurrent edit of the same slot committed.
 */
function writeIfFree(getSlot, excludeId, write) {
  return withTimetableLock(async (conn) => {
    const slot = await getSlot(conn);
    const conflicts = toConflicts(await repo.findOverlaps({ ...slot, excludeId }, conn));
    if (conflicts.length) throw ApiError.scheduleConflict(conflicts);
    return write(conn);
  });
}

/**
 * Runs `write(conn)` once every slot of class-subject `classSubjectId` is proven free of clashes with the other
 * slots of `teacherId` in the same academic year (the check behind a teacher reassignment).
 */
export function writeIfTeacherFree(classSubjectId, teacherId, write) {
  return withTimetableLock(async (conn) => {
    const overlaps = await repo.findTeacherOverlaps(classSubjectId, teacherId, conn);
    if (overlaps.length) throw ApiError.scheduleConflict(overlaps.map((row) => toConflict('teacher', row)));
    return write(conn);
  });
}

/** "  Lab   1 " -> "Lab 1": rooms are compared as saved, so spacing must not make two rooms differ. */
const normalizeRoom = (room) => (room == null ? null : room.trim().replace(/\s+/g, ' ') || null);

function assertTimeOrder({ startTime, endTime }) {
  if (endTime <= startTime) {
    throw ApiError.validation('endTime must be after startTime', undefined, {
      issues: [{ path: 'body.endTime', message: 'must be after startTime' }],
    });
  }
}

export async function listSchedules(user, listQuery) {
  await access.assertFiltersInScope(user, listQuery);
  const query = { ...listQuery, teacherId: resolveMe(user, listQuery.teacherId, 'teacher') };
  const { rows, meta } = await repo.listSchedules(query, access.classScope(user, 'cs.class_id'));
  return { data: rows.map(toScheduleShape), meta };
}

/**
 * Every slot matching `filters` (classId, classSubjectId, teacherId, dayOfWeek, academicYear), unscoped and
 * unpaged: dashboards and attendance rules count them, so none may be cut off by a page size.
 */
export async function findSlotsUnscoped(filters) {
  return (await repo.findSchedules(filters)).map(toScheduleShape);
}

export async function getSchedule(user, id) {
  const row = ApiError.assertFound(await repo.findScheduleById(id), 'schedule', id);
  await access.assertCanViewClassSubject(user, row.classSubjectId);
  return toScheduleShape(row);
}

/** "Math · Grade 10 - A, Monday 08:00-09:00 (Room 4)" for the activity log. */
const describeSlot = (slot) =>
  `${slot.classSubject.subjectName} · ${slot.classSubject.className}, ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}-${slot.endTime}${
    slot.room ? ` (${slot.room})` : ''
  }`;

const DAY_NAMES = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** What the activity log records of a slot; `lesson` names the subject and class it belongs to. */
const slotFields = ({ classSubject, dayOfWeek, startTime, endTime, room }) => ({
  lesson: `${classSubject.subjectName} · ${classSubject.className}`,
  dayOfWeek,
  startTime,
  endTime,
  room,
});

export async function createSchedule(body) {
  const slot = { ...body, room: normalizeRoom(body.room) };
  // Read back inside the transaction: the new row is there whatever happens after the commit.
  const schedule = await writeIfFree(
    () => slot,
    0,
    async (conn) => toScheduleShape(await repo.findScheduleById(await repo.insertSchedule(slot, conn), conn)),
  );
  const { id } = schedule;
  await record({
    action: 'schedule.create',
    entityId: id,
    summary: `Added the period ${describeSlot(schedule)}`,
    details: slotFields(schedule),
  });
  return schedule;
}

export async function updateSchedule(id, patch) {
  const fields = 'room' in patch ? { ...patch, room: normalizeRoom(patch.room) } : patch;
  let before;
  // The row before and after are both read inside the lock, so the log compares what this edit changed.
  const mergedSlot = async (conn) => {
    const existing = ApiError.assertFound(await repo.findScheduleById(id, conn), 'schedule', id);
    before = toScheduleShape(existing);
    const slot = {
      classSubjectId: existing.classSubjectId,
      dayOfWeek: existing.dayOfWeek,
      startTime: existing.startTime,
      endTime: existing.endTime,
      room: existing.room,
      ...fields,
    };
    assertTimeOrder(slot);
    return slot;
  };
  const schedule = await writeIfFree(mergedSlot, id, async (conn) => {
    await repo.updateSchedule(id, fields, conn);
    return toScheduleShape(await repo.findScheduleById(id, conn));
  });
  const changes = changesOf(slotFields(before), slotFields(schedule));
  if (changes) {
    await record({
      action: 'schedule.update',
      entityId: id,
      summary: `Changed the ${changedList(changes).replace('day of week', 'day')} of the period, now ${describeSlot(schedule)}`,
      details: { changes },
    });
  }
  return schedule;
}

export async function deleteSchedule(id) {
  const row = ApiError.assertFound(await repo.findScheduleById(id), 'schedule', id);
  if (!(await repo.deleteSchedule(id))) throw ApiError.notFound('schedule', id);
  const schedule = toScheduleShape(row);
  await record({
    action: 'schedule.delete',
    entityId: id,
    summary: `Removed the period ${describeSlot(schedule)}`,
    details: slotFields(schedule),
  });
  return { id };
}
