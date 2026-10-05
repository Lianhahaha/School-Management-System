/**
 * SQL for attendance: one mark per student per class-subject per date.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { CLASS_SUBJECT_REF_COLUMNS, WhereBuilder, buildSet, joinClassSubject } from '../../utils/sql.js';
import { enrolledInClassOn } from '../access/access.repository.js';

export const ATTENDANCE_SORT_MAP = {
  attendanceDate: 'a.attendance_date',
  status: 'a.status',
  studentLastName: 'u.last_name',
};

const COLUMNS = `a.id, a.student_id, s.student_number, u.first_name, u.last_name, a.class_subject_id,
  ${CLASS_SUBJECT_REF_COLUMNS}, a.attendance_date, a.status, a.remarks, a.marked_by,
  mu.first_name AS marker_first_name, mu.last_name AS marker_last_name, a.created_at, a.updated_at`;

const FROM = `FROM attendance a
  JOIN students s ON s.id = a.student_id
  JOIN users u ON u.id = s.user_id
  ${joinClassSubject('a')}
  JOIN users mu ON mu.id = a.marked_by`;

/** Filters shared by the flat list and the summary. */
function filtersToWhere(filters, scope) {
  return new WhereBuilder()
    .addIf(filters.studentId, 'a.student_id = ?')
    .addIf(filters.classSubjectId, 'a.class_subject_id = ?')
    .addIf(filters.classId, 'cs.class_id = ?')
    .addIf(filters.status, 'a.status = ?')
    .addIf(filters.dateFrom, 'a.attendance_date >= ?')
    .addIf(filters.dateTo, 'a.attendance_date <= ?')
    .addScope(scope);
}

export async function findAttendanceById(id) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE a.id = ?`, [id]))[0] ?? null;
}

export function listAttendance(listQuery, scope) {
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where: filtersToWhere(listQuery, scope),
    listQuery,
    sortMap: ATTENDANCE_SORT_MAP,
    defaultOrder: 'a.attendance_date DESC',
    tieBreaker: 'a.id',
  });
}

const COUNTS = `COUNT(*) AS total,
  COALESCE(SUM(a.status = 'present'), 0) AS present, COALESCE(SUM(a.status = 'absent'), 0) AS absent,
  COALESCE(SUM(a.status = 'late'), 0) AS late, COALESCE(SUM(a.status = 'excused'), 0) AS excused`;

/** Monday of the attendance date's week, as 'YYYY-MM-DD' (WEEKDAY: 0 = Monday). */
const WEEK_START_SQL = `DATE_FORMAT(DATE_SUB(a.attendance_date, INTERVAL WEEKDAY(a.attendance_date) DAY), '%Y-%m-%d')`;

/** Status counts, optionally grouped per student, per class-subject or per week (Monday first, oldest first). */
export function summarizeAttendance({ groupBy = 'none', ...filters }, scope) {
  const where = filtersToWhere(filters, scope);
  const base = `FROM attendance a
    JOIN students s ON s.id = a.student_id
    JOIN users u ON u.id = s.user_id
    ${joinClassSubject('a')}
    ${where.sql}`;
  if (groupBy === 'student') {
    return query(
      `SELECT s.id AS student_id, CONCAT(u.first_name, ' ', u.last_name) AS label, ${COUNTS} ${base}
        GROUP BY s.id, u.first_name, u.last_name ORDER BY u.last_name, u.first_name`,
      where.params,
    );
  }
  if (groupBy === 'week') {
    return query(
      `SELECT ${WEEK_START_SQL} AS week_start, ${COUNTS} ${base} GROUP BY week_start ORDER BY week_start`,
      where.params,
    );
  }
  if (groupBy === 'classSubject') {
    return query(
      `SELECT cs.id AS class_subject_id, CONCAT(c.name, ' - ', sub.name) AS label, ${COUNTS} ${base}
        GROUP BY cs.id, c.name, sub.name ORDER BY c.name, sub.name`,
      where.params,
    );
  }
  return query(`SELECT ${COUNTS} ${base}`, where.params);
}

/**
 * Sub-select `{ sql, params }` of the students on the sheet of one lesson and date: the class roster on that
 * date plus anyone already marked on it, so a mark stays correctable after its student left the class.
 */
const sheetStudentIds = (classSubjectId, date) => ({
  sql: `SELECT e.student_id FROM class_subjects cs JOIN enrollments e ON ${enrolledInClassOn('cs.class_id', '?')}
         WHERE cs.id = ?
        UNION
        SELECT a.student_id FROM attendance a WHERE a.class_subject_id = ? AND a.attendance_date = ?`,
  params: [date, date, classSubjectId, classSubjectId, date],
});

/** The sheet's students with the marks of that date merged in; unmarked rows have null status. */
export function findSheetRows(classSubjectId, date) {
  const roster = sheetStudentIds(classSubjectId, date);
  return query(
    `SELECT s.id AS student_id, s.student_number, u.first_name, u.last_name,
            a.id AS attendance_id, a.status, a.remarks, a.marked_by,
            mu.first_name AS marker_first_name, mu.last_name AS marker_last_name, a.updated_at
       FROM (${roster.sql}) roster
       JOIN students s ON s.id = roster.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance a ON a.class_subject_id = ? AND a.student_id = s.id AND a.attendance_date = ?
       LEFT JOIN users mu ON mu.id = a.marked_by
      ORDER BY u.last_name, u.first_name, s.id`,
    [...roster.params, classSubjectId, date],
  );
}

/** Ids among `classSubjectIds` that have at least one mark on `date`. */
export async function findMarkedClassSubjectIds(classSubjectIds, date) {
  if (!classSubjectIds.length) return [];
  const rows = await query(
    'SELECT DISTINCT class_subject_id FROM attendance WHERE attendance_date = ? AND class_subject_id IN (?)',
    [date, classSubjectIds],
  );
  return rows.map((row) => row.classSubjectId);
}

/** Ids of the students a sheet of this lesson and date may mark (see sheetStudentIds). */
export async function findRosterStudentIds(classSubjectId, date, conn) {
  const roster = sheetStudentIds(classSubjectId, date);
  return (await query(roster.sql, roster.params, conn)).map((row) => row.studentId);
}

/** Idempotent bulk upsert on UNIQUE(student, class-subject, date). Needs MySQL >= 8.0.19 (row alias). */
export async function upsertAttendance(classSubjectId, date, records, markedBy, conn) {
  const rows = records.map((r) => [r.studentId, classSubjectId, date, r.status, markedBy, r.remarks ?? null]);
  await run(
    `INSERT INTO attendance (student_id, class_subject_id, attendance_date, status, marked_by, remarks)
     VALUES ? AS new
     ON DUPLICATE KEY UPDATE status = new.status, marked_by = new.marked_by, remarks = new.remarks`,
    [rows],
    conn,
  );
}

const PATCH_COLUMNS = { status: 'status', remarks: 'remarks', markedBy: 'marked_by' };

export async function updateAttendance(id, fields) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE attendance SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

export async function deleteAttendance(id) {
  return (await run('DELETE FROM attendance WHERE id = ?', [id])).affectedRows;
}
