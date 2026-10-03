import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Flat attendance records. params: page, limit, sortBy (attendanceDate, ...), sortOrder, studentId
 * ('me' allowed), classSubjectId, classId, status, dateFrom, dateTo. This list does not accept `search`.
 * Without a scope filter a student gets their own records and a teacher their visible classes.
 */
export const listAttendance = (params) => api.get('/attendance', { params }).then(toPage);

/**
 * Counts per status and `rate` = (present + late) / total, or null when nothing is recorded.
 * params: studentId ('me'), classSubjectId, classId, dateFrom, dateTo, groupBy ('none' | 'student' | 'classSubject').
 * Resolves one object for groupBy 'none' (the default) and an array of them (each with a `label`) otherwise.
 */
export const getAttendanceSummary = (params) => api.get('/attendance/summary', { params }).then(toData);

/** Admin and teachers. The roster of the class-subject with the marks of one date (unmarked: null). */
export const getAttendanceSheet = ({ classSubjectId, date }) =>
  api.get('/attendance/sheet', { params: { classSubjectId, date } }).then(toData);

/**
 * Admin, or the subject's teacher. Idempotent upsert of the listed students; resolves the saved sheet.
 * records: [{ studentId, status, remarks? }], 1..200 rows. A future date is a 400.
 */
export const saveAttendanceSheet = ({ classSubjectId, date, records }) =>
  api.put('/attendance/sheet', { classSubjectId, date, records }).then(toData);

/** Admin, or the subject's teacher. Corrects one record: { status?, remarks? }. */
export const updateAttendance = (id, body) => api.patch(`/attendance/${id}`, body).then(toData);

/** Admin only. */
export const deleteAttendance = (id) => api.delete(`/attendance/${id}`).then(toData);
