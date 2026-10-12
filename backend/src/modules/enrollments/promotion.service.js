/**
 * Self-enrollment under the DepEd promotion rules. Once the end of a school year has closed a student's class
 * as `completed`, the results of that year decide where they may go next (nextClassStanding), and a promoted
 * or retained student enrolls themselves in one of the offered sections (enrollMyself). Students the rules
 * cannot judge are placed by an admin. The enrollment itself is the admin's (enrollments.service).
 * A new student, who signed up and was never placed (the application is still pending), is `new`: they pick a
 * section of the grade applied for in the current school year, and nobody approves it first. Every section
 * offered shows its head count and seats; a full one refuses the student (seatsPerClass).
 */
import { HIGHEST_GRADE_LEVEL, PASSING_GRADE, REMEDIAL_MAX_FAILED } from '../../constants/shared.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear, nextAcademicYear } from '../../utils/dates.js';
import { averageOf, subjectYearResults } from '../../utils/grading.js';
import { applicationOf } from '../admissions/admissions.service.js';
import { summarizeStudentGradesUnscoped } from '../grades/grades.service.js';
import { classesOfGrade } from '../classes/classes.service.js';
import { subjectIdsOfClass } from '../subjects/subjects.service.js';
import { enroll, seatsPerClass } from './enrollments.service.js';
import * as repo from './enrollments.repository.js';

/** The standings whose student enrolls themselves in one of the offered sections. */
const SELF_ENROLLING = ['promoted', 'retained', 'new'];

const classRef = (row) => ({
  id: row.classId,
  name: row.className,
  gradeLevel: row.gradeLevel,
  academicYear: row.academicYear,
});

/**
 * Where a student stands for next year, judged on the school year of their last completed class (see
 * NEXT_CLASS_STANDINGS) by each subject's school year grade, the average of its semester grades (each the
 * average of the quarterly grades graded in that semester; a semester with none is left out, utils/grading.js
 * subjectYearResults): every subject passed moves them up one grade level, 1-2 failed subjects need
 * remedial classes (an admin places them afterwards), 3 or more mean the same grade level again. A student
 * with no completed year, no grades in it, a subject of the completed class without a final grade (the year is
 * incomplete, so it is not judged on the other subjects alone), or whose next year has already passed is
 * placed by an admin.
 * `classes` are the sections the student may pick: the grade level in the year after the completed one.
 */
export async function nextClassStanding(studentId) {
  const standing = (status, extra = {}) => ({
    status,
    lastClass: null,
    generalAverage: null,
    failedSubjects: [],
    gradeLevel: null,
    academicYear: null,
    classes: [],
    ...extra,
  });
  const active = await repo.findActiveByStudent(studentId);
  if (active) return standing('enrolled', { lastClass: classRef(active) });
  // Signed up and never placed: enrolling admits an application, so a pending one has no enrollment history.
  const application = await applicationOf(studentId);
  if (application?.status === 'pending') {
    const { gradeLevel } = application;
    const academicYear = currentAcademicYear();
    return standing('new', {
      gradeLevel,
      academicYear,
      classes: await classesOfGrade(academicYear, gradeLevel),
    });
  }

  const last = await repo.findLastClosedByStudent(studentId);
  if (!last || last.status !== 'completed') return standing('needs_placement');
  const lastClass = classRef(last);
  const [results, classSubjectIds] = await Promise.all([
    summarizeStudentGradesUnscoped(studentId, last.academicYear),
    subjectIdsOfClass(last.classId),
  ]);
  const subjects = subjectYearResults(results)
    .filter((subject) => subject.percentage !== null)
    .map(({ subjectId, subjectName, percentage }) => ({ subjectId, subjectName, percentage }));
  if (!subjects.length) return standing('needs_placement', { lastClass });
  // A subject of the completed class with no final grade (from any class of that year) leaves the year
  // incomplete: passing the others does not promote.
  const withGrade = new Set(subjects.map((subject) => subject.subjectId));
  if (classSubjectIds.some((subjectId) => !withGrade.has(subjectId))) {
    return standing('needs_placement', { lastClass });
  }

  const generalAverage = averageOf(subjects.map((subject) => subject.percentage));
  const failedSubjects = subjects.filter((subject) => subject.percentage < PASSING_GRADE);
  const judged = { lastClass, generalAverage, failedSubjects };
  if (failedSubjects.length > 0 && failedSubjects.length <= REMEDIAL_MAX_FAILED) {
    return standing('remedial', judged);
  }
  const promoted = failedSubjects.length === 0;
  if (promoted && last.gradeLevel >= HIGHEST_GRADE_LEVEL) return standing('finished', judged);

  const academicYear = nextAcademicYear(last.academicYear);
  // A year that has already gone by (the student was away) cannot take students any more.
  if (academicYear < currentAcademicYear()) return standing('needs_placement', judged);
  const gradeLevel = promoted ? last.gradeLevel + 1 : last.gradeLevel;
  return standing(promoted ? 'promoted' : 'retained', {
    ...judged,
    gradeLevel,
    academicYear,
    classes: await classesOfGrade(academicYear, gradeLevel),
  });
}

/**
 * The signed-in student's standing (GET /enrollments/next-class). Each offered section carries `enrolled`
 * (students in it now) and `seats` (how many it takes from students enrolling themselves, the same for every
 * section of the grade), so a full one shows as full.
 */
export async function myNextClass(user) {
  const standing = await nextClassStanding(user.studentId);
  const seats = seatsPerClass(standing.classes.map((klass) => klass.studentCount));
  return {
    ...standing,
    classes: standing.classes.map((klass) => ({ ...klass, enrolled: klass.studentCount, seats })),
  };
}

/**
 * The signed-in student enrolls in one of the sections their standing offers (POST /enrollments/next-class).
 * The standing is worked out again here, so only a promoted, retained or new student, and only into an offered
 * section that has a seat left (409 `class_full`), gets in; the enrollment itself is the admin's (same checks,
 * same notifications and activity entry).
 */
export async function enrollMyself(user, { classId }) {
  const standing = await nextClassStanding(user.studentId);
  if (!SELF_ENROLLING.includes(standing.status)) {
    throw ApiError.conflict('you cannot enroll yourself; the school will place you', {
      reason: 'not_eligible',
      standing: standing.status,
    });
  }
  if (!standing.classes.some((klass) => klass.id === classId)) {
    throw ApiError.validation(
      `class is not a Grade ${standing.gradeLevel} section of ${standing.academicYear}`,
      undefined,
      { reason: 'class_not_offered', field: 'classId' },
    );
  }
  return enroll({ studentId: user.studentId, classId }, { limitSeats: true });
}
