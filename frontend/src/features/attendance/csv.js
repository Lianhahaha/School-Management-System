/** CSV columns for attendance records (GET /attendance items). */
import { ATTENDANCE_STATUS_LABELS } from '../../constants/ui';
import { fullName } from '../../utils/names';

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
