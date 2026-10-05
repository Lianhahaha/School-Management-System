import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { academicYearOf, isAfterToday } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { classSubjectRef, personRef, ratio } from '../../utils/shapes.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyStudents } from '../notifications/notifications.service.js';
import { assertSchoolDay, holidayOn } from '../calendar/calendar.service.js';
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
  ...(row.weekStart !== undefined && { weekStart: row.weekStart, label: row.weekStart }),
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

/** The sheet of one lesson and date; `holiday` names the school holiday on that date (no marking), or is null. */
async function buildSheet(classSubjectId, date) {
  const [classSubject, rows, holiday] = await Promise.all([
    getClassSubjectRefUnscoped(classSubjectId),
    repo.findSheetRows(classSubjectId, date),
    holidayOn(date),
  ]);
  return {
    classSubjectId,
    classSubject,
    date,
    holiday,
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

/**
 * Idempotent upsert of the listed students only; students left out of `records` keep their marks.
 * Not on a future date, outside the class's academic year or on a school holiday (400).
 */
export async function saveSheet(user, { classSubjectId, date, records }) {
  await access.assertCanManageClassSubject(user, classSubjectId);
  let previous;
  const classSubject = await getClassSubjectRefUnscoped(classSubjectId); // 404 for an unknown class-subject (admins)
  assertMarkableDate(date, classSubject.academicYear);
  await assertSchoolDay(date);
  await withTransaction(async (conn) => {
    const roster = new Set(await repo.findRosterStudentIds(classSubjectId, date, conn));
    const invalidStudentIds = records.map((r) => r.studentId).filter((id) => !roster.has(id));
    if (invalidStudentIds.length) {
      throw ApiError.validation('students were not enrolled in this class on this date', undefined, {
        reason: 'not_enrolled',
        invalidStudentIds,
      });
    }
    previous = await repo.findMarksOf(
      classSubjectId,
      date,
      records.map((r) => r.studentId),
      conn,
    );
    await repo.upsertAttendance(classSubjectId, date, records, user.id, conn);
  });
  const sheet = await buildSheet(classSubjectId, date);
  await recordSheetChanges(sheet, records, previous);
  return sheet;
}

/**
 * Logs a sheet save: how many marks are new or changed, and per student every changed mark and every new
 * mark that is not "present" (who was absent, late or excused is what a later question is about).
 */
async function recordSheetChanges(sheet, records, previous) {
  const nameOfStudent = new Map(sheet.records.map((row) => [row.studentId, nameOf(row)]));
  const added = records.filter((r) => !previous.has(r.studentId));
  const changed = records.filter((r) => previous.has(r.studentId) && previous.get(r.studentId) !== r.status);
  if (!added.length && !changed.length) return;
  const marks = [...changed, ...added.filter((r) => r.status !== 'present')].map((r) => ({
    studentId: r.studentId,
    student: nameOfStudent.get(r.studentId),
    from: previous.get(r.studentId) ?? null,
    to: r.status,
  }));
  const { subjectName, className } = sheet.classSubject;
  const parts = [added.length && `${added.length} new`, changed.length && `${changed.length} changed`];
  await record({
    action: 'attendance.save',
    entityId: sheet.classSubjectId,
    summary: `Marked attendance for ${subjectName} · ${className} on ${sheet.date}: ${parts.filter(Boolean).join(', ')}`,
    details: { date: sheet.date, marks },
  });
  await notifyAbsences(sheet, marks);
}

export async function updateAttendance(user, id, patch) {
  const existing = ApiError.assertFound(await repo.findAttendanceById(id), 'attendance record', id);
  await access.assertCanManageClassSubject(user, existing.classSubjectId);
  await repo.updateAttendance(id, { ...patch, markedBy: user.id });
  const updated = toAttendanceShape(await repo.findAttendanceById(id));
  if (updated.status !== existing.status || updated.remarks !== existing.remarks) {
    await record({
      action: 'attendance.update',
      entityId: updated.classSubjectId,
      summary: `Changed ${nameOf(updated.student)}'s mark in ${updated.classSubject.subjectName} · ${updated.classSubject.className} on ${updated.attendanceDate} from ${existing.status} to ${updated.status}`,
      details: {
        date: updated.attendanceDate,
        marks: [
          {
            studentId: updated.studentId,
            student: nameOf(updated.student),
            from: existing.status,
            to: updated.status,
          },
        ],
      },
    });
    await notifyAbsences(updated, [{ studentId: updated.studentId, to: updated.status }]);
  }
  return updated;
}

/** Tells each student marked absent or late (new marks, or marks changed to it) about it. */
function notifyAbsences({ classSubject, date, attendanceDate }, marks) {
  return notifyStudents(
    marks
      .filter((mark) => mark.to === 'absent' || mark.to === 'late')
      .map((mark) => ({
        studentId: mark.studentId,
        type: 'attendance',
        title: `Marked ${mark.to} in ${classSubject.subjectName}`,
        body: `${date ?? attendanceDate} · ${classSubject.className}`,
        link: '/student/attendance',
      })),
  );
}

export async function deleteAttendance(id) {
  const existing = await repo.findAttendanceById(id);
  if (!(await repo.deleteAttendance(id))) throw ApiError.notFound('attendance record', id);
  const mark = toAttendanceShape(existing);
  await record({
    action: 'attendance.delete',
    entityId: mark.classSubjectId,
    summary: `Removed ${nameOf(mark.student)}'s ${mark.status} mark in ${mark.classSubject.subjectName} · ${mark.classSubject.className} on ${mark.attendanceDate}`,
    details: {
      date: mark.attendanceDate,
      marks: [{ studentId: mark.studentId, student: nameOf(mark.student), from: mark.status, to: null }],
    },
  });
  return { id };
}
