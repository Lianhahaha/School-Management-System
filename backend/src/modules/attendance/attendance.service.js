import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { academicYearOf, isAfterToday } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef, ratio } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { getClassSubjectRefUnscoped } from '../classSubjects/classSubjects.service.js';
import * as repo from './attendance.repository.js';

const toStudentRef = (row) => ({
  id: row.studentId,
  studentNumber: row.studentNumber,
  firstName: row.firstName,
  lastName: row.lastName,
});

const toAttendanceShape = (row) => ({
  id: row.id,
  studentId: row.studentId,
  student: toStudentRef(row),
  classSubjectId: row.classSubjectId,
  classSubject: classSubjectRef(row),
  attendanceDate: row.attendanceDate,
  status: row.status,
  remarks: row.remarks,
  markedBy: personRef(row.markedBy, row.markerFirstName, row.markerLastName),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Applies the scoping rule shared by list and summary: own records for students, visible classes for teachers. */
async function scopeFilters(user, filters) {
  await access.assertFiltersInScope(user, filters);
  const studentId = access.scopedStudentId(user, resolveMe(user, filters.studentId, 'student'));
  const scope = access.isStudent(user) ? null : access.classScope(user, 'cs.class_id');
  return { filters: { ...filters, studentId }, scope };
}

export async function listAttendance(user, listQuery) {
  const { filters, scope } = await scopeFilters(user, listQuery);
  const { rows, meta } = await repo.listAttendance(filters, scope);
  return { data: rows.map(toAttendanceShape), meta };
}

const toSummaryRow = (row) => ({
  ...(row.studentId !== undefined && { studentId: row.studentId }),
  ...(row.classSubjectId !== undefined && { classSubjectId: row.classSubjectId }),
  ...(row.label !== undefined && { label: row.label }),
  total: row.total,
  present: row.present,
  absent: row.absent,
  late: row.late,
  excused: row.excused,
  rate: ratio(row.present + row.late, row.total),
});

/**
 * Summary for callers that did their own access checks (dashboards), optionally limited by `scope` (a class
 * scope fragment on cs.class_id). rate = (present + late) / total.
 */
export async function summarizeAttendanceUnscoped(filters, scope = null) {
  const rows = (await repo.summarizeAttendance(filters, scope)).map(toSummaryRow);
  return filters.groupBy && filters.groupBy !== 'none' ? rows : rows[0];
}

export async function getSummary(user, query) {
  const { filters, scope } = await scopeFilters(user, query);
  const rows = (await repo.summarizeAttendance(filters, scope)).map(toSummaryRow);
  return query.groupBy === 'none' ? rows[0] : rows;
}

/** Set of class-subject ids that have attendance marked on `date` (teacher dashboard; no access check). */
export async function markedClassSubjectIdsUnscoped(classSubjectIds, date) {
  return new Set(await repo.findMarkedClassSubjectIds(classSubjectIds, date));
}

async function buildSheet(classSubjectId, date) {
  const [classSubject, rows] = await Promise.all([
    getClassSubjectRefUnscoped(classSubjectId),
    repo.findSheetRows(classSubjectId, date),
  ]);
  return {
    classSubjectId,
    classSubject,
    date,
    records: rows.map((row) => ({
      studentId: row.studentId,
      studentNumber: row.studentNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      attendanceId: row.attendanceId,
      status: row.status,
      remarks: row.remarks,
      markedBy: personRef(row.markedBy, row.markerFirstName, row.markerLastName),
      updatedAt: row.updatedAt,
    })),
  };
}

export async function getSheet(user, { classSubjectId, date }) {
  await access.assertCanViewClassSubject(user, classSubjectId);
  return buildSheet(classSubjectId, date);
}

/** 400 unless attendance can be marked on `date`: not in the future and within the class's academic year. */
function assertMarkableDate(date, academicYear) {
  if (isAfterToday(date)) {
    throw ApiError.validation('attendance cannot be marked for a future date', undefined, {
      reason: 'future_date',
    });
  }
  if (academicYearOf(date) !== academicYear) {
    throw ApiError.validation(`date is outside the academic year ${academicYear}`, undefined, {
      reason: 'outside_academic_year',
      academicYear,
    });
  }
}

/** Idempotent upsert of the listed students only; students left out of `records` keep their marks. */
export async function saveSheet(user, { classSubjectId, date, records }) {
  await access.assertCanManageClassSubject(user, classSubjectId);
  const classSubject = await getClassSubjectRefUnscoped(classSubjectId); // 404 for an unknown class-subject (admins)
  assertMarkableDate(date, classSubject.academicYear);
  await withTransaction(async (conn) => {
    const roster = new Set(await repo.findRosterStudentIds(classSubjectId, date, conn));
    const invalidStudentIds = records.map((r) => r.studentId).filter((id) => !roster.has(id));
    if (invalidStudentIds.length) {
      throw ApiError.validation('students were not enrolled in this class on this date', undefined, {
        reason: 'not_enrolled',
        invalidStudentIds,
      });
    }
    await repo.upsertAttendance(classSubjectId, date, records, user.id, conn);
  });
  return buildSheet(classSubjectId, date);
}

export async function updateAttendance(user, id, patch) {
  const existing = ApiError.assertFound(await repo.findAttendanceById(id), 'attendance record', id);
  await access.assertCanManageClassSubject(user, existing.classSubjectId);
  await repo.updateAttendance(id, { ...patch, markedBy: user.id });
  return toAttendanceShape(await repo.findAttendanceById(id));
}

export async function deleteAttendance(id) {
  if (!(await repo.deleteAttendance(id))) throw ApiError.notFound('attendance record', id);
  return { id };
}
