/**
 * The "needs attention" list of the admin and teacher dashboards: students whose attendance or general average
 * this school year is below the AT_RISK lines, worst first.
 */
import { academicYearStart, currentAcademicYear, todayYmd } from '../../utils/dates.js';
import * as access from '../access/access.service.js';
import { summarizeAttendanceUnscoped } from '../attendance/attendance.service.js';
import { studentResultsUnscoped } from '../grades/grades.service.js';
import * as repo from './dashboard.repository.js';

/**
 * "Needs attention": attendance below 80 % this school year (once a student has 5 marks, so one absence on
 * the first day does not flag anyone), or a general average below 75 % (the usual passing mark).
 */
const AT_RISK = Object.freeze({
  attendanceRateBelow: 0.8,
  minAttendanceMarks: 5,
  gradeAverageBelow: 75,
  limit: 10,
});

/** How far below its line a student is, in percentage points (the sort key: worst first). */
const shortfall = (student) =>
  Math.max(
    student.reasons.includes('attendance')
      ? (AT_RISK.attendanceRateBelow - student.attendance.rate) * 100
      : 0,
    student.reasons.includes('grades') ? AT_RISK.gradeAverageBelow - student.gradeAverage : 0,
  );

/**
 * Students enrolled this academic year in the classes the user can see (every class for admins, the classes
 * a teacher teaches or leads) whose attendance or general average is below the AT_RISK lines. Both figures
 * cover the current academic year within the same classes.
 */
export async function atRiskStudents(user) {
  const year = currentAcademicYear();
  const [students, attendance, results] = await Promise.all([
    repo.findEnrolledStudents(year, access.classScope(user, 'e.class_id')),
    summarizeAttendanceUnscoped(
      { groupBy: 'student', dateFrom: academicYearStart(year), dateTo: todayYmd() },
      access.classScope(user, 'cs.class_id'),
    ),
    studentResultsUnscoped(year, access.classScope(user, 'cs.class_id')),
  ]);
  const attendanceOf = new Map(attendance.map((row) => [row.studentId, row]));

  const flagged = students
    .map((student) => {
      const marks = attendanceOf.get(student.studentId);
      const gradeAverage = results.get(student.studentId) ?? null;
      const reasons = [];
      if (marks && marks.total >= AT_RISK.minAttendanceMarks && marks.rate < AT_RISK.attendanceRateBelow) {
        reasons.push('attendance');
      }
      if (gradeAverage !== null && gradeAverage < AT_RISK.gradeAverageBelow) reasons.push('grades');
      return {
        studentId: student.studentId,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        classId: student.classId,
        className: student.className,
        attendance: marks ? { rate: marks.rate, marks: marks.total } : null,
        gradeAverage,
        reasons,
      };
    })
    .filter((student) => student.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || shortfall(b) - shortfall(a));

  return {
    attendanceRateBelow: AT_RISK.attendanceRateBelow,
    minAttendanceMarks: AT_RISK.minAttendanceMarks,
    gradeAverageBelow: AT_RISK.gradeAverageBelow,
    total: flagged.length,
    students: flagged.slice(0, AT_RISK.limit),
  };
}
