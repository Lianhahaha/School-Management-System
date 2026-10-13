/**
 * GET /dashboard: one payload per role, discriminated by `role` (student assistants get the admin's).
 * "Today" and the current academic year come from the school's time zone. Each request reads the clock once
 * (`schoolDay`): today's weekday and school year are worked out from that one date, so a request running
 * across midnight never mixes Sunday's date with Monday's lessons. Data owned by other modules is fetched
 * through their services; only true aggregates live in dashboard.repository.
 */
import { academicYearOf, academicYearStart, isoWeekdayOf, todayYmd } from '../../utils/dates.js';
import { subjectFinalGrade } from '../../utils/grading.js';
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

/** A grade as the student dashboard lists it. */
const toRecentGrade = (grade) => ({
  gradeId: grade.id,
  assessmentId: grade.assessmentId,
  title: grade.assessment.title,
  type: grade.assessment.type,
  subjectName: grade.assessment.subjectName,
  score: grade.score,
  maxScore: grade.assessment.maxScore,
  percentage: grade.percentage,
  assessedOn: grade.assessment.assessedOn,
});

/** Today in the school's time zone, read from the clock once, with its ISO weekday and school year. */
function schoolDay() {
  const today = todayYmd();
  return { today, weekday: isoWeekdayOf(today), year: academicYearOf(today) };
}

const unique = (values) => [...new Set(values)];

/**
 * A student's grade summary of one school year, one row per subject, from their class-subject summary rows
 * of that year (summarizeStudentGradesUnscoped). A subject taken in two classes (the student changed class)
 * is one row: its quarters of both classes put together per semester and quarter (utils/grading
 * subjectFinalGrade), the grade My grades, the general average and the promotion check give it, so
 * the dashboard never shows it twice with two different results. `className` names the classes it was taken
 * in ('Grade 10 - A / Grade 10 - B') and `assessmentsGraded` counts the scores of all of them. The rows are
 * of one school year, so the subject alone is the key. In My grades' order: class, then subject.
 */
function subjectGradeSummary(rows) {
  const bySubject = new Map();
  for (const row of rows) bySubject.set(row.subjectId, [...(bySubject.get(row.subjectId) ?? []), row]);
  return [...bySubject.values()]
    .map((group) => ({
      subjectId: group[0].subjectId,
      subjectName: group[0].subjectName,
      className: unique(group.map((row) => row.className)).join(' / '),
      classSubjectIds: group.map((row) => row.classSubjectId),
      assessmentsGraded: group.reduce((sum, row) => sum + row.assessmentsGraded, 0),
      percentage: subjectFinalGrade(group),
    }))
    .sort(
      (a, b) =>
        a.className.localeCompare(b.className) ||
        a.subjectName.localeCompare(b.subjectName) ||
        a.subjectId - b.subjectId,
    );
}

/**
 * Today's timetable periods (`slots`) that take attendance, and the set of class-subjects marked today. A
 * period of a class nobody is in today is left out, unless its sheet already has marks: that sheet has nobody
 * to mark, so it could never be saved and would stay "not marked yet" all day.
 */
async function periodsToMark(slots, today) {
  const [marked, classesWithStudents] = await Promise.all([
    markedClassSubjectIdsUnscoped(unique(slots.map((slot) => slot.classSubjectId)), today),
    repo.findClassIdsWithStudentsOn(unique(slots.map((slot) => slot.classSubject.classId)), today),
  ]);
  const periods = slots.filter(
    (slot) => marked.has(slot.classSubjectId) || classesWithStudents.has(slot.classSubject.classId),
  );
  return { periods, marked };
}

const byStartTime = (a, b) => a.startTime.localeCompare(b.startTime);

/**
 * Today's attendance to mark school-wide (none on a holiday): how many of today's timetable periods take
 * attendance and how many of them are marked (see periodsToMark), the unit the teacher's dashboard counts
 * too, and the sheets still to mark: one per class-subject (two periods of one subject share a sheet), at its
 * first start time, with all its `periods` of today. The admin's card counts those periods against the clock
 * ("2 periods later today"), so every figure on it is in periods like the marked count.
 */
async function attendanceToMark({ today, weekday, year }, holiday) {
  if (holiday) return { lessonsScheduled: 0, lessonsMarked: 0, unmarkedLessons: [] };
  const slots = await findSlotsUnscoped({ dayOfWeek: weekday, academicYear: year });
  const { periods, marked } = await periodsToMark(slots, today);
  const unmarked = new Map(); // classSubjectId -> its periods of today
  for (const slot of periods) {
    if (marked.has(slot.classSubjectId)) continue;
    unmarked.set(slot.classSubjectId, [...(unmarked.get(slot.classSubjectId) ?? []), slot]);
  }
  return {
    lessonsScheduled: periods.length,
    lessonsMarked: periods.filter((slot) => marked.has(slot.classSubjectId)).length,
    unmarkedLessons: [...unmarked.values()]
      .map((sheetSlots) => sheetSlots.sort(byStartTime))
      .sort((a, b) => byStartTime(a[0], b[0]))
      .map((sheetSlots) => {
        const [first] = sheetSlots;
        return {
          classSubjectId: first.classSubjectId,
          classId: first.classSubject.classId,
          className: first.classSubject.className,
          subjectName: first.classSubject.subjectName,
          teacher: first.classSubject.teacher,
          startTime: first.startTime,
          endTime: first.endTime,
          periods: sheetSlots.map(({ startTime, endTime }) => ({ startTime, endTime })),
        };
      }),
  };
}

async function adminDashboard(user) {
  const day = schoolDay();
  const { today } = day;
  const [counts, attendance, enrollmentsByGrade, upcoming, announcements, atRisk, events, holiday] =
    await Promise.all([
      repo.findAdminCounts(day.year),
      summarizeAttendanceUnscoped({ dateFrom: today, dateTo: today }),
      repo.findEnrollmentsByGrade(day.year),
      upcomingAssessmentsUnscoped({ today, days: 7, limit: 5 }),
      briefAnnouncements(user),
      atRiskStudents(user, today),
      upcomingEvents({ today }),
      holidayOn(today),
    ]);
  const toMark = await attendanceToMark(day, holiday);
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
    attendanceToday: { date: today, ...attendance, ...toMark },
    enrollmentsByGrade: enrollmentsByGrade.map((row) => ({
      gradeLevel: row.gradeLevel,
      students: row.students,
    })),
    upcomingAssessments: upcoming.items,
    upcomingAssessmentsTotal: upcoming.total,
    recentAnnouncements: announcements,
    atRisk,
    upcomingEvents: events,
  };
}

async function teacherDashboard(user) {
  const { today, weekday, year } = schoolDay();
  const teacherId = user.teacherId;
  const [teacher, classSubjects, homeroom, timetabled, pending, announcements, atRisk, events, holiday] =
    await Promise.all([
      getTeacher(user, teacherId),
      repo.findTeacherClassSubjects(teacherId, year),
      listClasses(user, { page: 1, limit: 100, homeroomTeacherId: teacherId, academicYear: year }),
      findSlotsUnscoped({ teacherId, dayOfWeek: weekday, academicYear: year }),
      pendingGradingUnscoped(teacherId, year, { today }),
      briefAnnouncements(user),
      atRiskStudents(user, today),
      upcomingEvents({ today }),
      holidayOn(today),
    ]);
  // A school holiday has no lessons: nothing to teach or mark, so today's list stays empty. Neither does a
  // class nobody is in today (see periodsToMark).
  const { periods, marked } = await periodsToMark(holiday ? [] : timetabled, today);
  const todaySchedule = periods.map((slot) => ({
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
  const { today, weekday, year: thisYear } = schoolDay();
  const classId = user.activeClassId;
  const [student, klass, announcements, events, holiday] = await Promise.all([
    getStudent(user, user.studentId),
    classId ? getClass(classId) : null,
    briefAnnouncements(user),
    upcomingEvents({ today }),
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
  const year = klass && klass.academicYear <= thisYear ? klass.academicYear : thisYear;
  const isClassOfThisYear = klass?.academicYear === thisYear;
  const dateFrom = academicYearStart(year);
  // The school year's results, with or without a class: a student withdrawn mid-year keeps both their marks
  // and their grades, as on My attendance and My grades.
  const resultsOfYear = Promise.all([
    summarizeAttendanceUnscoped({ studentId: user.studentId, dateFrom, dateTo: today }),
    summarizeStudentGradesUnscoped(user.studentId, year),
    recentGradesUnscoped(user.studentId, 5),
  ]).then(([attendance, gradeRows, recent]) => ({
    attendanceSummary: { dateFrom, dateTo: today, ...attendance },
    gradeSummary: subjectGradeSummary(gradeRows),
    recentGrades: recent.map(toRecentGrade),
  }));
  if (!klass) {
    return {
      ...base,
      currentEnrollment: null,
      todaySchedule: [],
      ...(await resultsOfYear),
      upcomingAssessments: [],
      upcomingAssessmentsTotal: 0,
    };
  }

  // One round of queries for the rest, the year's results included.
  const [results, slots, upcoming] = await Promise.all([
    resultsOfYear,
    holiday || !isClassOfThisYear ? [] : findSlotsUnscoped({ classId, dayOfWeek: weekday }),
    upcomingAssessmentsUnscoped({ classId, today, days: 7, limit: 5 }),
  ]);
  return {
    ...base,
    // The enrollment as /auth/me gives it, plus the homeroom teacher.
    currentEnrollment: {
      ...student.currentEnrollment,
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
    ...results,
    upcomingAssessments: upcoming.items,
    upcomingAssessmentsTotal: upcoming.total,
  };
}

/** A student assistant gets the admin's payload as it is, `role: 'admin'` included (it names the payload). */
export function getDashboard(user) {
  if (access.isOffice(user)) return adminDashboard(user);
  if (access.isTeacher(user)) return teacherDashboard(user);
  return studentDashboard(user);
}
