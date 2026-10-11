/**
 * Admissions: the application a student sends with a self-registration (the grade applied for, the previous
 * school), the documents the school office ticks off, and the outcome. Nobody approves or declines it: the
 * student picks a section of the grade applied for themselves (promotion.service, standing `new`), and
 * enrolling the student in a class, by themselves or by the office, admits them (enrollments.service marks the
 * application admitted inside its own transaction). `declined` remains only on applications declined before
 * students picked their class. Students created by an admin or an import have no application. Applications are
 * read as part of the student shape (`admission`).
 */
import { ApiError } from '../../utils/ApiError.js';
import { changesOf, nameOf, record } from '../activity/activity.service.js';
import { getStudent } from '../students/students.service.js';
import * as repo from './admissions.repository.js';

/** Inserts the application of a new self-registered student. Runs inside the caller's transaction (users.service). */
export const createApplication = (studentId, application, conn) =>
  repo.insertApplication(studentId, application, conn);

/** The students now have a class: their applications, if any, are admitted. Runs inside the enrolling transaction. */
export const admit = (studentIds, conn) => repo.markAdmitted(studentIds, conn);

/** Deletes the application of an account being deleted. Runs inside its transaction, before the profile goes. */
export const deleteForUser = (userId, conn) => repo.deleteByUserId(userId, conn);

/** The student's application row ({ status, gradeLevel, ... }), or null for a student who did not sign up. */
export const applicationOf = (studentId) => repo.findApplication(studentId);

const findApplication = async (studentId) =>
  ApiError.assertFound(await repo.findApplication(studentId), 'application', studentId);

/** How the activity log names each document of the checklist. */
const DOCUMENTS = { birthCertificateReceived: 'birth certificate', reportCardReceived: 'report card' };

/** Ticks documents off (or back on) the checklist, whatever the status: papers may arrive after admission. */
export async function updateChecklist(user, studentId, patch) {
  const before = await findApplication(studentId);
  await repo.updateChecklist(studentId, patch);
  const student = await getStudent(user, studentId);
  const changes = changesOf(before, patch);
  if (changes) {
    const received = Object.entries(changes).map(
      ([field, { to }]) => `${DOCUMENTS[field]} ${to ? 'received' : 'not received'}`,
    );
    await record({
      action: 'admission.update',
      entityId: studentId,
      summary: `Application of ${nameOf(student)}: ${received.join(', ')}`,
      details: { studentNumber: student.studentNumber, changes },
    });
  }
  return student;
}
