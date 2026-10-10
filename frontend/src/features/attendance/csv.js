/**
 * CSV for attendance: the flat records (GET /attendance items), and DepEd school form 2 (SF2, Daily Attendance
 * Report) of one section and month.
 */
import { ATTENDANCE_STATUS_LABELS } from '../../constants/ui';
import { formatShortDate } from '../../utils/date';
import { fullName } from '../../utils/names';
import { SEX_LETTERS, inSchoolFormOrder } from '../students/csv';

export const ATTENDANCE_CSV_COLUMNS = [
  { header: 'Date', value: (record) => record.attendanceDate },
  { header: 'Class', value: (record) => record.classSubject.className },
  { header: 'Subject', value: (record) => record.classSubject.subjectName },
  { header: 'Student no', value: (record) => record.student.studentNumber },
  { header: 'Student', value: (record) => fullName(record.student) },
  { header: 'Status', value: (record) => ATTENDANCE_STATUS_LABELS[record.status] ?? record.status },
  { header: 'Remarks', value: (record) => record.remarks },
  { header: 'Marked by', value: (record) => fullName(record.markedBy) },
];

/**
 * A learner's whole day on the SF2, judged on every lesson marked that day: 'A' when every mark is absent or
 * excused ('E' instead when they are all excused; both count as an absent day), 'T' when any mark is late and
 * the day is not an absence, blank when the learner was present.
 * @param {{ total: number, absent: number, late: number, excused: number }} day the counts of one learner and day
 * @returns {'A' | 'E' | 'T' | ''}
 */
export function sf2DayMark({ total, absent, late, excused }) {
  if (absent + excused === total) return excused === total ? 'E' : 'A';
  return late > 0 ? 'T' : '';
}

/**
 * The SF2 of one section and month: one row per learner in the order of the school forms, one column per date
 * on which anyone in the section was marked ('-' for a learner without a mark that day), then the learner's
 * absent days (A and E) and tardy days (T). A learner marked that month who is no longer on the roster is
 * listed after the others under the name on the marks, without LRN or sex. A month without marks has no rows.
 *
 * @param {Array<{ id: number, lrn?: string | null, firstName: string, lastName: string,
 *   gender?: string | null }>} roster the section's learners (GET /students?classId=)
 * @param {Array<{ studentId: number, label: string, date: string, total: number, absent: number, late: number,
 *   excused: number }>} dayRows the month's GET /attendance/summary?groupBy=studentDay rows
 */
export function sf2Sheet(roster, dayRows) {
  const dates = [...new Set(dayRows.map((day) => day.date))].sort();
  /** @type {Map<number, Map<string, string>>} studentId -> date -> mark */
  const marks = new Map();
  for (const day of dayRows) {
    if (!marks.has(day.studentId)) marks.set(day.studentId, new Map());
    marks.get(day.studentId).set(day.date, sf2DayMark(day));
  }

  const onRoster = new Set(roster.map((student) => student.id));
  const learners = [
    ...inSchoolFormOrder(roster).map((student) => ({
      id: student.id,
      lrn: student.lrn,
      name: fullName(student),
      sex: SEX_LETTERS[student.gender],
    })),
    ...[...new Map(dayRows.map((day) => [day.studentId, day.label]))]
      .filter(([studentId]) => !onRoster.has(studentId))
      .map(([studentId, label]) => ({ id: studentId, lrn: null, name: label, sex: undefined })),
  ];

  const rows =
    dates.length === 0
      ? []
      : learners.map((learner) => {
          const days = dates.map((date) => marks.get(learner.id)?.get(date) ?? '-');
          return {
            ...learner,
            days,
            absent: days.filter((mark) => mark === 'A' || mark === 'E').length,
            tardy: days.filter((mark) => mark === 'T').length,
          };
        });

  const columns = [
    { header: 'LRN', value: (row) => row.lrn, text: true },
    { header: 'Learner', value: (row) => row.name },
    { header: 'Sex', value: (row) => row.sex },
    ...dates.map((date, index) => ({ header: formatShortDate(date), value: (row) => row.days[index] })),
    { header: 'Absent', value: (row) => row.absent },
    { header: 'Tardy', value: (row) => row.tardy },
  ];
  return { columns, rows };
}
