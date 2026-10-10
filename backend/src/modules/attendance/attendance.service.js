import { withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { academicYearOf, formatDayLabel, isAfterToday, isoWeekdayOf } from '../../utils/dates.js';
import { classSubjectRef, personRef, ratio } from '../../utils/shapes.js';
import { assertAsSeen, assertOnRoster, changeOf, isEdited, remarksOf } from '../../utils/sheets.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { notifyStudents } from '../notifications/notifications.service.js';
import { assertSchoolDay, holidayOn } from '../calendar/calendar.service.js';
import { getClassSubjectRefUnscoped } from '../classSubjects/classSubjects.service.js';
import { findSlotsUnscoped } from '../schedules/schedules.service.js';
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

export async function listAttendance(user, listQuery) {
  const { filters, scope } = await access.scopeRecordFilters(user, listQuery);
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
  const { filters, scope } = await access.scopeRecordFilters(user, query);
  const rows = (await repo.summarizeAttendance(filters, scope)).map(toSummaryRow);
  return query.groupBy === 'none' ? rows[0] : rows;
}

/** Set of class-subject ids that have attendance marked on `date` (teacher dashboard; no access check). */
export async function markedClassSubjectIdsUnscoped(classSubjectIds, date) {
  return new Set(await repo.findMarkedClassSubjectIds(classSubjectIds, date));
}

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO weekdays (1 = Monday) on which the lesson is on the timetable, ascending; empty while it has no slots. */
async function lessonDaysOf(classSubjectId) {
  const slots = await findSlotsUnscoped({ classSubjectId });
  return [...new Set(slots.map((slot) => slot.dayOfWeek))].sort((a, b) => a - b);
}

/**
 * The sheet of one lesson and date. `holiday` names the school holiday on that date (no marking), or is null;
 * `lessonDays` are the weekdays the lesson meets (empty until it is on the timetable). A caller that has just
 * read the lesson days (a save checks them) passes them as `knownLessonDays` so they are not read twice.
 */
async function buildSheet(classSubjectId, date, knownLessonDays) {
  const [classSubject, rows, holiday, lessonDays] = await Promise.all([
    getClassSubjectRefUnscoped(classSubjectId),
    repo.findSheetRows(classSubjectId, date),
    holidayOn(date),
    knownLessonDays ?? lessonDaysOf(classSubjectId),
  ]);
  return {
    classSubjectId,
    classSubject,
    date,
    holiday,
    lessonDays,
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
 * 400 when the lesson is on the timetable (`lessonDays`) but not on `date`'s weekday, so no lesson took place:
 * a mark there would be a session that never happened and would skew every attendance rate. A lesson without
 * any slot yet is not checked.
 */
function assertLessonDay(lessonDays, date, subjectName) {
  if (lessonDays.length === 0 || lessonDays.includes(isoWeekdayOf(date))) return;
  throw ApiError.validation(
    `${subjectName} has no periods on ${WEEKDAY_NAMES[isoWeekdayOf(date)]}s`,
    undefined,
    { reason: 'no_lesson_on_day', lessonDays },
  );
}

const hasMarksOn = async (classSubjectId, date) =>
  (await repo.findMarkedClassSubjectIds([classSubjectId], date)).length > 0;

/**
 * Idempotent upsert of the listed students only; students left out of `records` keep their marks.
 * Not on a future date, outside the class's academic year, or (unless the date already has marks to correct)
 * on a school holiday or a weekday the lesson does not meet (400). When the records carry `previous` and a
 * stored mark no longer matches it, someone saved meanwhile: 409 sheet_changed and nothing is written.
 */
export async function saveSheet(user, { classSubjectId, date, records: input }) {
  await access.assertCanManageClassSubject(user, classSubjectId);
  const records = input.map((r) => ({ ...r, remarks: remarksOf(r.remarks) }));
  let previous;
  const classSubject = await getClassSubjectRefUnscoped(classSubjectId); // 404 for an unknown class-subject (admins)
  assertMarkableDate(date, classSubject.academicYear);
  // Marks taken before a holiday was declared on that day stay correctable, as do marks on a weekday the
  // lesson has since left the timetable: both checks guard only a date's first marks.
  const hasMarks = await hasMarksOn(classSubjectId, date);
  if (!hasMarks) await assertSchoolDay(date);
  const lessonDays = await lessonDaysOf(classSubjectId); // also the saved sheet's
  if (!hasMarks) assertLessonDay(lessonDays, date, classSubject.subjectName);
  await withTransaction(async (conn) => {
    // First: every read below sees what a save that finished just before this one wrote.
    await repo.lockClassSubject(classSubjectId, conn);
    const roster = await repo.findRosterStudentIds(classSubjectId, date, conn);
    assertOnRoster(records, roster, 'students were not enrolled in this class on this date');
    previous = await repo.findMarksOf(
      classSubjectId,
      date,
      records.map((r) => r.studentId),
      conn,
    );
    assertAsSeen(
      records,
      previous,
      'status',
      'someone saved this sheet after you opened it; reload it to see their marks',
    );
    await repo.upsertAttendance(classSubjectId, date, records, user.id, conn);
  });
  const sheet = await buildSheet(classSubjectId, date, lessonDays);
  await recordSheetChanges(sheet, records, previous);
  return sheet;
}

/**
 * Logs a sheet save: how many marks are new or changed (status or remarks), and per student every changed
 * mark and every new mark that is not "present" (who was absent, late or excused is what a later question is
 * about). Students hear about new or changed absent and late marks, not about remark edits.
 */
async function recordSheetChanges(sheet, records, previous) {
  const nameOfStudent = new Map(sheet.records.map((row) => [row.studentId, nameOf(row)]));
  const added = records.filter((r) => !previous.has(r.studentId));
  const changed = records.filter(
    (r) => previous.has(r.studentId) && isEdited(previous.get(r.studentId), r, 'status'),
  );
  if (!added.length && !changed.length) return;
  const marks = [...changed, ...added.filter((r) => r.status !== 'present')].map((r) =>
    changeOf(r, previous.get(r.studentId), 'status', nameOfStudent.get(r.studentId)),
  );
  const { subjectName, className } = sheet.classSubject;
  const parts = [added.length && `${added.length} new`, changed.length && `${changed.length} changed`];
  await record({
    action: 'attendance.save',
    entityId: sheet.classSubjectId,
    summary: `Marked attendance for ${subjectName} · ${className} on ${formatDayLabel(sheet.date)}: ${parts.filter(Boolean).join(', ')}`,
    details: { date: sheet.date, marks },
  });
  await notifyAbsences(
    sheet,
    marks.filter((mark) => mark.from !== mark.to),
  );
}

/** Tells each student marked absent or late (new marks, or marks changed to it) about it. */
function notifyAbsences({ classSubject, date }, marks) {
  return notifyStudents(
    marks
      .filter((mark) => mark.to === 'absent' || mark.to === 'late')
      .map((mark) => ({
        studentId: mark.studentId,
        type: 'attendance',
        title: `Marked ${mark.to} in ${classSubject.subjectName}`,
        body: `${formatDayLabel(date)} · ${classSubject.className}`,
        link: '/student/attendance',
      })),
  );
}
