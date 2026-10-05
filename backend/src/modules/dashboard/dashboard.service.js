/**
 * GET /dashboard: one payload per role, discriminated by `role`. "Today" and the current
 * academic year come from the school's time zone. Data owned by other modules is fetched through
 * their services; only true aggregates live in dashboard.repository.
 */
import { academicYearStart, currentAcademicYear, todayIsoWeekday, todayYmd } from '../../utils/dates.js';
import * as access from '../access/access.service.js';
import { recentAnnouncements } from '../announcements/announcements.service.js';
import {
  markedClassSubjectIdsUnscoped,
  summarizeAttendanceUnscoped,
} from '../attendance/attendance.service.js';
import { pendingGradingUnscoped, upcomingAssessmentsUnscoped } from '../assessments/assessments.service.js';
import { getClass, listClasses } from '../classes/classes.service.js';
import {
  recentGradesUnscoped,
  studentResultsUnscoped,
  summarizeStudentGradesUnscoped,
} from '../grades/grades.service.js';
import { findSlotsUnscoped } from '../schedules/schedules.service.js';
import { getStudent } from '../students/students.service.js';
import { getTeacher } from '../teachers/teachers.service.js';
import * as repo from './dashboard.repository.js';

const toAnnouncementBrief = (a) => ({
  id: a.id,
  title: a.title,
  audience: a.audience,
  className: a.className,
  publishedAt: a.publishedAt,
});

const briefAnnouncements = async (user) => (await recentAnnouncements(user, 5)).map(toAnnouncementBrief);

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
async function atRiskStudents(user) {
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

async function adminDashboard(user) {
  const today = todayYmd();
  const [counts, attendance, enrollmentsByGrade, upcoming, announcements, atRisk] = await Promise.all([
    repo.findAdminCounts(currentAcademicYear()),
    summarizeAttendanceUnscoped({ dateFrom: today, dateTo: today }),
    repo.findEnrollmentsByGrade(),
    upcomingAssessmentsUnscoped({ days: 7, limit: 10 }),
    briefAnnouncements(user),
    atRiskStudents(user),
  ]);
  return {
    role: 'admin',
    counts: {
      students: counts.students,
      teachers: counts.teachers,
      classes: counts.classes,
      subjects: counts.subjects,
      teacherAssignments: counts.teacherAssignments,
      timetableSlots: counts.timetableSlots,
      activeEnrollments: counts.activeEnrollments,
      unenrolledStudents: counts.unenrolledStudents,
    },
    attendanceToday: { date: today, ...attendance },
    enrollmentsByGrade: enrollmentsByGrade.map((row) => ({
      gradeLevel: row.gradeLevel,
      students: row.students,
    })),
    upcomingAssessments: upcoming,
    recentAnnouncements: announcements,
    atRisk,
  };
}

async function teacherDashboard(user) {
  const today = todayYmd();
  const year = currentAcademicYear();
  const teacherId = user.teacherId;
  const [teacher, classSubjects, homeroom, slots, pending, announcements, atRisk] = await Promise.all([
    getTeacher(user, teacherId),
    repo.findTeacherClassSubjects(teacherId, year),
    listClasses(user, { page: 1, limit: 100, homeroomTeacherId: teacherId, academicYear: year }),
    findSlotsUnscoped({ teacherId, dayOfWeek: todayIsoWeekday(), academicYear: year }),
    pendingGradingUnscoped(teacherId, year),
    briefAnnouncements(user),
    atRiskStudents(user),
  ]);
  const marked = await markedClassSubjectIdsUnscoped(
    slots.map((slot) => slot.classSubjectId),
    today,
  );
  const todaySchedule = slots.map((slot) => ({
    scheduleId: slot.id,
    classSubjectId: slot.classSubjectId,
    className: slot.classSubject.className,
    subjectName: slot.classSubject.subjectName,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
    attendanceMarked: marked.has(slot.classSubjectId),
  }));
  return {
    role: 'teacher',
    teacher: {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      department: teacher.department,
    },
    classSubjects: classSubjects.map((row) => ({
      id: row.id,
      classId: row.classId,
      className: row.className,
      subjectName: row.subjectName,
      academicYear: row.academicYear,
      studentCount: row.studentCount,
    })),
    homeroomClasses: homeroom.data.map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academicYear,
      studentCount: c.studentCount,
    })),
    todaySchedule,
    attendanceToday: {
      sessionsScheduled: todaySchedule.length,
      sessionsMarked: todaySchedule.filter((slot) => slot.attendanceMarked).length,
    },
    pendingGrading: pending,
    recentAnnouncements: announcements,
    atRisk,
  };
}

async function studentDashboard(user) {
  const today = todayYmd();
  const classId = user.activeClassId;
  const [student, klass, announcements] = await Promise.all([
    getStudent(user, user.studentId),
    classId ? getClass(classId) : null,
    briefAnnouncements(user),
  ]);
  const base = {
    role: 'student',
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
    },
    recentAnnouncements: announcements,
  };
  const dateFrom = academicYearStart(klass?.academicYear ?? currentAcademicYear());
  const attendance = await summarizeAttendanceUnscoped({
    studentId: user.studentId,
    dateFrom,
    dateTo: today,
  });
  const attendanceSummary = { dateFrom, dateTo: today, ...attendance };
  if (!klass) {
    return {
      ...base,
      currentEnrollment: null,
      todaySchedule: [],
      attendanceSummary,
      gradeSummary: [],
      recentGrades: [],
      upcomingAssessments: [],
    };
  }

  const [slots, gradeSummary, recent, upcoming] = await Promise.all([
    findSlotsUnscoped({ classId, dayOfWeek: todayIsoWeekday() }),
    summarizeStudentGradesUnscoped(user.studentId, classId),
    recentGradesUnscoped(user.studentId, 5),
    upcomingAssessmentsUnscoped({ classId, days: 7, limit: 5 }),
  ]);
  return {
    ...base,
    currentEnrollment: {
      classId: klass.id,
      className: klass.name,
      gradeLevel: klass.gradeLevel,
      academicYear: klass.academicYear,
      homeroomTeacher: klass.homeroomTeacher,
    },
    todaySchedule: slots.map((slot) => ({
      scheduleId: slot.id,
      classSubjectId: slot.classSubjectId,
      subjectName: slot.classSubject.subjectName,
      teacher: slot.classSubject.teacher,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
    })),
    attendanceSummary,
    gradeSummary: gradeSummary.map((row) => ({
      classSubjectId: row.classSubjectId,
      subjectName: row.subjectName,
      assessmentsGraded: row.assessmentsGraded,
      percentage: row.percentage,
    })),
    recentGrades: recent.map((grade) => ({
      gradeId: grade.id,
      assessmentId: grade.assessmentId,
      title: grade.assessment.title,
      type: grade.assessment.type,
      subjectName: grade.assessment.subjectName,
      score: grade.score,
      maxScore: grade.assessment.maxScore,
      percentage: grade.percentage,
      assessedOn: grade.assessment.assessedOn,
    })),
    upcomingAssessments: upcoming,
  };
}

export function getDashboard(user) {
  if (access.isAdmin(user)) return adminDashboard(user);
  if (access.isTeacher(user)) return teacherDashboard(user);
  return studentDashboard(user);
}
