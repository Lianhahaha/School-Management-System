/**
 * SQL for attendance: one mark per student per class-subject per date.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { CLASS_SUBJECT_REF_COLUMNS, WhereBuilder, buildSet, joinClassSubject } from '../../utils/sql.js';

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

/** Status counts, optionally grouped per student or per class-subject. */
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
  if (groupBy === 'classSubject') {
    return query(
      `SELECT cs.id AS class_subject_id, CONCAT(c.name, ' - ', sub.name) AS label, ${COUNTS} ${base}
        GROUP BY cs.id, c.name, sub.name ORDER BY c.name, sub.name`,
      where.params,
    );
  }
  return query(`SELECT ${COUNTS} ${base}`, where.params);
}

/** The class roster (active enrollments) with the marks of one date merged in; unmarked rows have null status. */
export function findSheetRows(classSubjectId, date) {
  return query(
    `SELECT s.id AS student_id, s.student_number, u.first_name, u.last_name,
            a.id AS attendance_id, a.status, a.remarks, a.marked_by,
            mu.first_name AS marker_first_name, mu.last_name AS marker_last_name, a.updated_at
       FROM class_subjects cs
       JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance a ON a.class_subject_id = cs.id AND a.student_id = s.id AND a.attendance_date = ?
       LEFT JOIN users mu ON mu.id = a.marked_by
      WHERE cs.id = ?
      ORDER BY u.last_name, u.first_name, s.id`,
    [date, classSubjectId],
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

export async function findRosterStudentIds(classSubjectId, conn) {
  const rows = await query(
    `SELECT e.student_id FROM class_subjects cs
       JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active' WHERE cs.id = ?`,
    [classSubjectId],
    conn,
  );
  return rows.map((row) => row.studentId);
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
