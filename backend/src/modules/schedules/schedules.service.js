import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import * as repo from './schedules.repository.js';

const toScheduleShape = (row) => ({
  id: row.id,
  classSubjectId: row.classSubjectId,
  classSubject: {
    ...classSubjectRef(row),
    teacher: personRef(row.teacherId, row.teacherFirstName, row.teacherLastName),
  },
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  room: row.room,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** One entry per (overlapping slot, shared resource): the class, the teacher or the room. */
function toConflicts(rows) {
  const conflicts = [];
  for (const row of rows) {
    for (const [type, shared] of [
      ['class', row.sameClass],
      ['teacher', row.sameTeacher],
      ['room', row.sameRoom],
    ]) {
      if (!shared) continue;
      conflicts.push({
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
    }
  }
  return conflicts;
}

const TIMETABLE_LOCK = 'school_timetable';

/**
 * Runs `write(conn)` after proving the slot has no conflicts. Check and write share one transaction and
 * a named lock, so two concurrent edits cannot both pass the check.
 */
function writeIfFree(slot, excludeId, write) {
  return withTransaction(async (conn) => {
    await conn.query('SELECT GET_LOCK(?, 5)', [TIMETABLE_LOCK]);
    try {
      const conflicts = toConflicts(await repo.findOverlaps({ ...slot, excludeId }, conn));
      if (conflicts.length) throw ApiError.scheduleConflict(conflicts);
      return await write(conn);
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [TIMETABLE_LOCK]);
    }
  });
}

const normalizeRoom = (room) => (room == null ? null : room.trim() || null);

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

/** Unscoped slots matching `filters` (classId, teacherId, dayOfWeek, academicYear); dashboards only. */
export async function findSlots(filters) {
  const { rows } = await repo.listSchedules({ page: 1, limit: 100, ...filters }, null);
  return rows.map(toScheduleShape);
}

export async function getSchedule(user, id) {
  const row = ApiError.assertFound(await repo.findScheduleById(id), 'schedule', id);
  await access.assertCanViewClassSubject(user, row.classSubjectId);
  return toScheduleShape(row);
}

export async function createSchedule(body) {
  const slot = { ...body, room: normalizeRoom(body.room) };
  const id = await writeIfFree(slot, 0, (conn) => repo.insertSchedule(slot, conn));
  return toScheduleShape(await repo.findScheduleById(id));
}

export async function updateSchedule(id, patch) {
  const existing = ApiError.assertFound(await repo.findScheduleById(id), 'schedule', id);
  const fields = 'room' in patch ? { ...patch, room: normalizeRoom(patch.room) } : patch;
  const slot = {
    classSubjectId: existing.classSubjectId,
    dayOfWeek: existing.dayOfWeek,
    startTime: existing.startTime,
    endTime: existing.endTime,
    room: existing.room,
    ...fields,
  };
  assertTimeOrder(slot);
  await writeIfFree(slot, id, (conn) => repo.updateSchedule(id, fields, conn));
  return toScheduleShape(await repo.findScheduleById(id));
}

export async function deleteSchedule(id) {
  if (!(await repo.deleteSchedule(id))) throw ApiError.notFound('schedule', id);
  return { id };
}
