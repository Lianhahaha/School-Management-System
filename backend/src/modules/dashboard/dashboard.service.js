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
import { holidayOn, upcomingEvents } from '../calendar/calendar.service.js';
import { getClass, listClasses } from '../classes/classes.service.js';
import { recentGradesUnscoped, summarizeStudentGradesUnscoped } from '../grades/grades.service.js';
import { findSlotsUnscoped } from '../schedules/schedules.service.js';
import { getStudent } from '../students/students.service.js';
import { getTeacher } from '../teachers/teachers.service.js';
import { atRiskStudents } from './atRisk.service.js';
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
 * Today's lessons school-wide as attendance sheets: one per class-subject on the timetable today (two periods
 * of one subject share a sheet), at its first start time, with whether it is marked. None on a holiday.
 */
async function lessonsToday(today, holiday) {
  if (holiday) return [];
  const slots = await findSlotsUnscoped({
    dayOfWeek: todayIsoWeekday(),
    academicYear: currentAcademicYear(),
  });
  const firstSlots = new Map();
  for (const slot of slots) {
    const seen = firstSlots.get(slot.classSubjectId);
    if (!seen || slot.startTime < seen.startTime) firstSlots.set(slot.classSubjectId, slot);
  }
  const lessons = [...firstSlots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const marked = await markedClassSubjectIdsUnscoped(
    lessons.map((slot) => slot.classSubjectId),
    today,
  );
  return lessons.map((slot) => ({
    classSubjectId: slot.classSubjectId,
    classId: slot.classSubject.classId,
    className: slot.classSubject.className,
    subjectName: slot.classSubject.subjectName,
    teacher: slot.classSubject.teacher,
    startTime: slot.startTime,
    endTime: slot.endTime,
    marked: marked.has(slot.classSubjectId),
  }));
}

async function adminDashboard(user) {
  const today = todayYmd();
  const [counts, attendance, enrollmentsByGrade, upcoming, announcements, atRisk, events, holiday] =
    await Promise.all([
      repo.findAdminCounts(currentAcademicYear()),
      summarizeAttendanceUnscoped({ dateFrom: today, dateTo: today }),
      repo.findEnrollmentsByGrade(),
      upcomingAssessmentsUnscoped({ days: 7, limit: 10 }),
      briefAnnouncements(user),
      atRiskStudents(user),
      upcomingEvents(),
      holidayOn(today),
    ]);
  const lessons = await lessonsToday(today, holiday);
  return {
    role: 'admin',
    holidayToday: holiday,
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
    attendanceToday: {
      date: today,
      ...attendance,
      lessonsScheduled: lessons.length,
      lessonsMarked: lessons.filter((lesson) => lesson.marked).length,
      unmarkedLessons: lessons
        .filter((lesson) => !lesson.marked)
        .map(({ marked: _marked, ...lesson }) => lesson),
    },
    enrollmentsByGrade: enrollmentsByGrade.map((row) => ({
      gradeLevel: row.gradeLevel,
      students: row.students,
    })),
    upcomingAssessments: upcoming,
    recentAnnouncements: announcements,
    atRisk,
    upcomingEvents: events,
  };
}

async function teacherDashboard(user) {
  const today = todayYmd();
  const year = currentAcademicYear();
  const teacherId = user.teacherId;
  const [teacher, classSubjects, homeroom, timetabled, pending, announcements, atRisk, events, holiday] =
    await Promise.all([
      getTeacher(user, teacherId),
      repo.findTeacherClassSubjects(teacherId, year),
      listClasses(user, { page: 1, limit: 100, homeroomTeacherId: teacherId, academicYear: year }),
      findSlotsUnscoped({ teacherId, dayOfWeek: todayIsoWeekday(), academicYear: year }),
      pendingGradingUnscoped(teacherId, year),
      briefAnnouncements(user),
      atRiskStudents(user),
      upcomingEvents(),
      holidayOn(today),
    ]);
  // A school holiday has no lessons: nothing to teach or mark, so today's list stays empty.
  const slots = holiday ? [] : timetabled;
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
    holidayToday: holiday,
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
    upcomingEvents: events,
  };
}

async function studentDashboard(user) {
  const today = todayYmd();
  const classId = user.activeClassId;
  const [student, klass, announcements, events, holiday] = await Promise.all([
    getStudent(user, user.studentId),
    classId ? getClass(classId) : null,
    briefAnnouncements(user),
    upcomingEvents(),
    holidayOn(today),
  ]);
  const base = {
    role: 'student',
    holidayToday: holiday,
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
    },
    recentAnnouncements: announcements,
    upcomingEvents: events,
  };
  // The school year the figures cover: the class's, unless the student is already placed in next year's
  // class; that year has not started, so its dates would run backwards and its timetable is not today's.
  const thisYear = currentAcademicYear();
  const year = klass && klass.academicYear <= thisYear ? klass.academicYear : thisYear;
  const isClassOfThisYear = klass?.academicYear === thisYear;
  const dateFrom = academicYearStart(year);
  const attendanceOfYear = summarizeAttendanceUnscoped({
    studentId: user.studentId,
    dateFrom,
    dateTo: today,
  });
  if (!klass) {
    return {
      ...base,
      currentEnrollment: null,
      todaySchedule: [],
      attendanceSummary: { dateFrom, dateTo: today, ...(await attendanceOfYear) },
      gradeSummary: [],
      recentGrades: [],
      upcomingAssessments: [],
    };
  }

  // One round of queries for the rest, the attendance summary included.
  const [attendance, slots, gradeSummary, recent, upcoming] = await Promise.all([
    attendanceOfYear,
    holiday || !isClassOfThisYear ? [] : findSlotsUnscoped({ classId, dayOfWeek: todayIsoWeekday() }),
    summarizeStudentGradesUnscoped(user.studentId, year),
    recentGradesUnscoped(user.studentId, 5),
    upcomingAssessmentsUnscoped({ classId, days: 7, limit: 5 }),
  ]);
  const attendanceSummary = { dateFrom, dateTo: today, ...attendance };
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
      className: row.className,
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
