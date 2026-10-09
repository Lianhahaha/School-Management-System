/**
 * Enrollment workflow. A student has at most one active enrollment (enforced by
 * the database); a transfer closes the old row and opens the new one in a single
 * transaction. Every enrollment is a new row, also a return to a class the
 * student left, so each period in a class stays on record for dated rosters.
 * Only classes of the current or a future academic year accept students.
 * The end of a school year closes a class's rows as `completed` and can move the students on in one step.
 * After that a student may enroll themselves in a section of the grade level their results allow
 * (nextClassStanding); students the rules cannot judge are placed by an admin.
 */
import { withTransaction } from '../../config/db.js';
import { HIGHEST_GRADE_LEVEL, PASSING_GRADE, REMEDIAL_MAX_FAILED } from '../../constants/shared.js';
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear, nextAcademicYear, todayYmd } from '../../utils/dates.js';
import { averageOf, subjectYearResults } from '../../utils/grading.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { nameOf, record } from '../activity/activity.service.js';
import { summarizeStudentGradesUnscoped } from '../grades/grades.service.js';
import { notifyStudents, resolveSignups } from '../notifications/notifications.service.js';
import { assertEnrollableClass, classesOfGrade, findReferencedClass } from '../classes/classes.service.js';
import * as repo from './enrollments.repository.js';

const toEnrollmentShape = (row) => ({
  id: row.id,
  studentId: row.studentId,
  student: {
    id: row.studentId,
    studentNumber: row.studentNumber,
    firstName: row.firstName,
    lastName: row.lastName,
  },
  classId: row.classId,
  class: { id: row.classId, name: row.className, gradeLevel: row.gradeLevel, academicYear: row.academicYear },
  status: row.status,
  enrolledOn: row.enrolledOn,
  leftOn: row.leftOn,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listEnrollments(user, listQuery) {
  const studentId = access.scopedStudentId(user, resolveMe(user, listQuery.studentId, 'student'));
  // A student's rows are already limited to themselves, so filtering by a class they left is fine.
  if (listQuery.classId !== undefined && !access.isStudent(user)) {
    await access.assertCanViewClass(user, listQuery.classId);
  }
  // Students see their own whole history (no class scope); teachers only enrollments of visible classes.
  const scope = access.isStudent(user) ? null : access.classScope(user, 'e.class_id');
  const { rows, meta } = await repo.listEnrollments({ ...listQuery, studentId }, scope);
  return { data: rows.map(toEnrollmentShape), meta };
}

export async function getEnrollment(user, id) {
  const row = ApiError.assertFound(await repo.findEnrollmentById(id), 'enrollment', id);
  if (access.isStudent(user)) access.scopedStudentId(user, row.studentId);
  else await access.assertCanViewClass(user, row.classId);
  return toEnrollmentShape(row);
}

/** 400 listing the ids that do not exist, or that belong to deactivated students. */
async function assertEnrollable(studentIds, conn) {
  const found = await repo.findStudentsActivity(studentIds, conn);
  const activeIds = new Set(found.filter((student) => student.isActive).map((student) => student.id));
  const invalidStudentIds = studentIds.filter((id) => !activeIds.has(id));
  if (invalidStudentIds.length) {
    throw ApiError.validation('students do not exist or are deactivated', undefined, {
      reason: 'student_not_enrollable',
      invalidStudentIds,
    });
  }
}

const alreadyEnrolled = (active) =>
  ApiError.conflict('student already has an active enrollment', {
    reason: 'already_enrolled',
    activeEnrollmentId: active.id,
    classId: active.classId,
  });

const someAlreadyEnrolled = (activeRows) =>
  ApiError.conflict('some students already have an active enrollment', {
    reason: 'already_enrolled',
    alreadyActive: activeRows.map((row) => ({
      studentId: row.studentId,
      enrollmentId: row.id,
      classId: row.classId,
    })),
  });

/** The bell notification of a student who joined `enrollment`'s class. */
const enrollmentNote = (enrollment, title, body) => ({
  studentId: enrollment.studentId,
  type: 'enrollment',
  title,
  body,
  link: '/student/class',
});

const isOneActiveCollision = (error) =>
  error?.code === 'ER_DUP_ENTRY' && /uq_enrollments_one_active/.test(error.sqlMessage ?? '');

/**
 * Runs an enrolling transaction. The service checks for an active enrollment first; when another
 * request enrolls the same student in between, the unique index refuses the insert, and this turns
 * that into the same 409 the check gives (read after the rollback, so the other row is visible).
 */
async function enrollingTransaction(studentIds, work) {
  try {
    return await withTransaction(work);
  } catch (error) {
    if (!isOneActiveCollision(error)) throw error;
    const active = await repo.findActiveByStudents(studentIds);
    throw active.length === 1 && studentIds.length === 1
      ? alreadyEnrolled(active[0])
      : someAlreadyEnrolled(active);
  }
}

/**
 * Opens an active enrollment in `classId` for each student, all or nothing, and returns the new ids in order.
 * Nothing is written when the class or any student is invalid or already in a class; `refusal(activeRows)`
 * builds that 409 (one student or a list).
 */
function enrollInClass(classId, studentIds, refusal) {
  return enrollingTransaction(studentIds, async (conn) => {
    await assertEnrollable(studentIds, conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudents(studentIds, conn);
    if (active.length) throw refusal(active);
    const today = todayYmd();
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, classId, today, conn));
    }
    return created;
  });
}

/** One activity entry for the new enrollments (all in one class) and a bell notification for each student. */
async function announceEnrollments(enrollments) {
  const [first] = enrollments;
  const { name: className, academicYear } = first.class;
  const names = enrollments.map((enrollment) => nameOf(enrollment.student));
  await record({
    action: 'enrollment.create',
    ...(enrollments.length === 1
      ? {
          entityId: first.id,
          summary: `Enrolled ${names[0]} in ${className}, ${academicYear}`,
          details: { student: names[0], className },
        }
      : {
          summary: `Enrolled ${enrollments.length} students in ${className}, ${academicYear}`,
          details: { className, students: names },
        }),
  });
  await notifyStudents(
    enrollments.map((enrollment) =>
      enrollmentNote(enrollment, `You are enrolled in ${className}`, academicYear),
    ),
  );
  await resolveSignups(enrollments.map((enrollment) => enrollment.student.id));
}

export async function enroll({ studentId, classId }) {
  const [id] = await enrollInClass(classId, [studentId], (active) => alreadyEnrolled(active[0]));
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await announceEnrollments([enrollment]);
  return enrollment;
}

/** All-or-nothing: nothing is written when the class or any student is invalid or already enrolled. */
export async function enrollMany({ classId, studentIds }) {
  const ids = await enrollInClass(classId, studentIds, someAlreadyEnrolled);
  // One query for the whole batch: a query per row would exhaust the connection pool on large batches.
  const enrollments = (await repo.findEnrollmentsByIds(ids)).map(toEnrollmentShape);
  await announceEnrollments(enrollments);
  return { classId, created: ids.length, enrollments };
}

/** Move a student to another class: close the active row as `transferred`, then open the new one. */
export async function transfer({ studentId, classId }) {
  let fromClass;
  const id = await enrollingTransaction([studentId], async (conn) => {
    await assertEnrollable([studentId], conn);
    await assertEnrollableClass(classId, conn);
    const active = await repo.findActiveByStudent(studentId, conn);
    if (!active) {
      throw ApiError.conflict('student has no active enrollment; enroll them instead', {
        reason: 'no_active_enrollment',
      });
    }
    if (active.classId === classId) {
      throw ApiError.conflict('student is already enrolled in this class', { reason: 'same_class', classId });
    }
    // One date for both rows: the student leaves the old class and joins the new one on the same day.
    const today = todayYmd();
    // Another request (a withdrawal, a deactivation) may have closed the row since it was read.
    if ((await repo.closeEnrollments([active.id], 'transferred', today, conn)) === 0) {
      throw ApiError.conflict('the enrollment was closed meanwhile; reload and try again', {
        reason: 'invalid_status_transition',
      });
    }
    fromClass = active.className;
    return repo.insertEnrollment(studentId, classId, today, conn);
  });
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await record({
    action: 'enrollment.transfer',
    entityId: id,
    summary: `Moved ${nameOf(enrollment.student)} from ${fromClass} to ${enrollment.class.name}`,
    details: { student: nameOf(enrollment.student), fromClass, toClass: enrollment.class.name },
  });
  await notifyStudents([
    enrollmentNote(enrollment, `You moved to ${enrollment.class.name}`, `From ${fromClass}`),
  ]);
  return enrollment;
}

/**
 * The end of a school year for one class: the listed students' active enrollments in `classId` close as
 * `completed` and, with `nextClassId`, they join that class of a later year. All or nothing; students of the
 * class who are not listed stay active. Both rows carry today's date, as in a transfer, so this belongs after
 * the last school day: from today the students leave this class's sheets, earlier days stay editable.
 */
export async function completeYear({ classId, studentIds, nextClassId }) {
  let klass;
  let next = null;
  let closedIds = [];
  const createdIds = await enrollingTransaction(studentIds, async (conn) => {
    // Runs for one class are serialised on the class row: a second run waits, then finds the students closed
    // (locking only the enrollment rows lets two runs deadlock on the index gaps their updates touch).
    klass = await findReferencedClass(classId, 'classId', conn, { forUpdate: true });
    // A completed row can never be reopened, so a year that has not started cannot be closed by mistake.
    if (klass.academicYear > currentAcademicYear()) {
      throw ApiError.validation(`the ${klass.academicYear} school year has not started yet`, undefined, {
        reason: 'year_not_started',
        field: 'classId',
        academicYear: klass.academicYear,
      });
    }
    if (nextClassId !== undefined) {
      next = await assertEnrollableClass(nextClassId, conn, 'nextClassId');
      if (next.academicYear <= klass.academicYear) {
        throw ApiError.validation('the next class must belong to a later school year', undefined, {
          reason: 'not_later_academic_year',
          field: 'nextClassId',
          academicYear: next.academicYear,
        });
      }
      await assertEnrollable(studentIds, conn);
    }
    // Locked until commit: a transfer or withdrawal of one of these students waits, then finds the row closed.
    const active = await repo.findActiveByStudents(studentIds, conn, { forUpdate: true });
    const inClass = new Map(
      active.filter((row) => row.classId === classId).map((row) => [row.studentId, row.id]),
    );
    const invalidStudentIds = studentIds.filter((studentId) => !inClass.has(studentId));
    if (invalidStudentIds.length) {
      throw ApiError.conflict('some students are not active in this class', {
        reason: 'not_active_in_class',
        classId,
        invalidStudentIds,
      });
    }
    const today = todayYmd();
    closedIds = studentIds.map((studentId) => inClass.get(studentId));
    await repo.closeEnrollments(closedIds, 'completed', today, conn);
    if (!next) return [];
    const created = [];
    for (const studentId of studentIds) {
      created.push(await repo.insertEnrollment(studentId, nextClassId, today, conn));
    }
    return created;
  });

  const closed = (await repo.findEnrollmentsByIds(closedIds)).map(toEnrollmentShape);
  const enrollments = (await repo.findEnrollmentsByIds(createdIds)).map(toEnrollmentShape);
  const count = `${closed.length} student${closed.length === 1 ? '' : 's'}`;
  await record({
    action: 'enrollment.complete',
    summary: `Completed the ${klass.academicYear} school year of ${count} in ${klass.name}${
      next ? `, now in ${next.name}, ${next.academicYear}` : ''
    }`,
    details: {
      className: klass.name,
      academicYear: klass.academicYear,
      ...(next && { nextClass: `${next.name}, ${next.academicYear}` }),
      students: closed.map((enrollment) => nameOf(enrollment.student)),
    },
  });
  await notifyStudents(
    enrollments.map((enrollment) =>
      enrollmentNote(
        enrollment,
        `You are enrolled in ${enrollment.class.name}`,
        `${enrollment.class.academicYear} · ${klass.name} completed`,
      ),
    ),
  );
  return { classId, nextClassId: next?.id ?? null, completed: closed.length, enrollments };
}

/* ------------------------------------------------- self-enrollment (DepEd promotion rules) */

const classRef = (row) => ({
  id: row.classId,
  name: row.className,
  gradeLevel: row.gradeLevel,
  academicYear: row.academicYear,
});

/**
 * Where a student stands for next year, judged on the school year of their last completed class (see
 * NEXT_CLASS_STANDINGS): every subject passed moves them up one grade level, 1-2 failed subjects need
 * remedial classes (an admin places them afterwards), 3 or more mean the same grade level again. A student
 * with no completed year, no grades in it, or whose next year has already passed is placed by an admin.
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

  const last = await repo.findLastClosedByStudent(studentId);
  if (!last || last.status !== 'completed') return standing('needs_placement');
  const lastClass = classRef(last);
  const subjects = subjectYearResults(await summarizeStudentGradesUnscoped(studentId, last.academicYear))
    .filter((subject) => subject.percentage !== null)
    .map(({ subjectId, subjectName, percentage }) => ({ subjectId, subjectName, percentage }));
  if (!subjects.length) return standing('needs_placement', { lastClass });

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

/** The signed-in student's standing (GET /enrollments/next-class). */
export function myNextClass(user) {
  return nextClassStanding(user.studentId);
}

/**
 * The signed-in student enrolls in one of the sections their standing offers (POST /enrollments/next-class).
 * The standing is worked out again here, so only a promoted or retained student, and only into an offered
 * section, gets in; the enrollment itself is the admin's (same checks, same notifications and activity entry).
 */
export async function enrollMyself(user, { classId }) {
  const standing = await nextClassStanding(user.studentId);
  if (standing.status !== 'promoted' && standing.status !== 'retained') {
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
  return enroll({ studentId: user.studentId, classId });
}

/** Close an active enrollment as `completed` or `withdrawn`. Closed rows cannot be changed. */
export async function setStatus(id, status) {
  const alreadyClosed = (from) =>
    ApiError.conflict(`enrollment is already ${from}`, {
      reason: 'invalid_status_transition',
      from,
      to: status,
    });
  const row = ApiError.assertFound(await repo.findEnrollmentById(id), 'enrollment', id);
  if (row.status !== 'active') throw alreadyClosed(row.status);
  await withTransaction(async (conn) => {
    // Another request (a transfer, a second admin) may have closed it since the check above.
    if ((await repo.closeEnrollments([id], status, todayYmd(), conn)) === 0) {
      throw alreadyClosed((await repo.findEnrollmentById(id, conn)).status);
    }
  });
  const enrollment = toEnrollmentShape(await repo.findEnrollmentById(id));
  await record({
    action: 'enrollment.close',
    entityId: id,
    summary: `Closed ${nameOf(enrollment.student)}'s enrollment in ${enrollment.class.name} as ${status}`,
    details: { student: nameOf(enrollment.student), className: enrollment.class.name, status },
  });
  return enrollment;
}

/** Withdraw the student's active enrollment, if any (used when an account is deactivated). */
export function closeActiveForStudent(studentId, status, conn) {
  return repo.closeActiveByStudent(studentId, status, todayYmd(), conn);
}
