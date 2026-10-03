/**
 * SQL for schedules (weekly timetable slots of a class-subject) and the
 * overlap query behind conflict detection.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { CLASS_SUBJECT_REF_COLUMNS, WhereBuilder, buildSet, joinClassSubject } from '../../utils/sql.js';

export const SCHEDULE_SORT_MAP = { dayOfWeek: 'sch.day_of_week', startTime: 'sch.start_time' };

const COLUMNS = `sch.id, sch.class_subject_id, ${CLASS_SUBJECT_REF_COLUMNS},
  tu.first_name AS teacher_first_name, tu.last_name AS teacher_last_name,
  sch.day_of_week, sch.start_time, sch.end_time, sch.room, sch.created_at, sch.updated_at`;

const FROM = `FROM schedules sch
  ${joinClassSubject('sch')}
  JOIN teachers t ON t.id = cs.teacher_id
  JOIN users tu ON tu.id = t.user_id`;

export async function findScheduleById(id, conn) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE sch.id = ?`, [id], conn))[0] ?? null;
}

export function listSchedules(listQuery, scope) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['sub.name', 'c.name', 'sch.room'])
    .addIf(listQuery.classId, 'cs.class_id = ?')
    .addIf(listQuery.teacherId, 'cs.teacher_id = ?')
    .addIf(listQuery.classSubjectId, 'sch.class_subject_id = ?')
    .addIf(listQuery.dayOfWeek, 'sch.day_of_week = ?')
    .addIf(listQuery.room, 'sch.room = ?')
    .addIf(listQuery.academicYear, 'c.academic_year = ?')
    .addScope(scope);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: SCHEDULE_SORT_MAP,
    defaultOrder: 'sch.day_of_week ASC, sch.start_time ASC',
    tieBreaker: 'sch.id',
  });
}

export async function insertSchedule({ classSubjectId, dayOfWeek, startTime, endTime, room }, conn) {
  const result = await run(
    'INSERT INTO schedules (class_subject_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)',
    [classSubjectId, dayOfWeek, startTime, endTime, room ?? null],
    conn,
  );
  return result.insertId;
}

const PATCH_COLUMNS = {
  classSubjectId: 'class_subject_id',
  dayOfWeek: 'day_of_week',
  startTime: 'start_time',
  endTime: 'end_time',
  room: 'room',
};

export async function updateSchedule(id, fields, conn) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE schedules SET ${set.sql} WHERE id = ?`, [...set.params, id], conn);
}

export async function deleteSchedule(id) {
  return (await run('DELETE FROM schedules WHERE id = ?', [id])).affectedRows;
}

/**
 * Slots that overlap `[startTime, endTime)` on `dayOfWeek` and share the class, the teacher or the room
 * with the class-subject being scheduled. Only slots of the same academic year compete. Back-to-back
 * slots do not overlap. `excludeId` is the slot being edited (0 when creating).
 */
export function findOverlaps({ classSubjectId, dayOfWeek, startTime, endTime, room, excludeId = 0 }, conn) {
  const sameRoom = `(sch.room IS NOT NULL AND ? IS NOT NULL AND LOWER(TRIM(sch.room)) = LOWER(TRIM(?)))`;
  return query(
    `SELECT sch.id AS schedule_id, sch.class_subject_id, c.name AS class_name, sub.name AS subject_name,
            sch.day_of_week, sch.start_time, sch.end_time, sch.room,
            (cs.class_id = target.class_id) AS same_class,
            (cs.teacher_id = target.teacher_id) AS same_teacher,
            ${sameRoom} AS same_room
       FROM class_subjects target
       JOIN classes tc ON tc.id = target.class_id
       JOIN schedules sch ON sch.day_of_week = ? AND sch.start_time < ? AND sch.end_time > ? AND sch.id <> ?
       JOIN class_subjects cs ON cs.id = sch.class_subject_id
       JOIN classes c ON c.id = cs.class_id AND c.academic_year = tc.academic_year
       JOIN subjects sub ON sub.id = cs.subject_id
      WHERE target.id = ?
        AND (cs.class_id = target.class_id OR cs.teacher_id = target.teacher_id OR ${sameRoom})
      ORDER BY sch.start_time, sch.id`,
    [room, room, dayOfWeek, endTime, startTime, excludeId, classSubjectId, room, room],
    conn,
  );
}
