/**
 * SQL for the admissions table: one application per self-registered student, keyed by student_id.
 * The applications are read as part of the student shape (students.repository joins this table).
 */
import { query, run } from '../../config/db.js';
import { buildSet } from '../../utils/sql.js';

const COLUMNS = `student_id, grade_level, previous_school, status, birth_certificate_received,
  report_card_received, decline_reason, created_at`;

export async function findApplication(studentId, conn) {
  return (
    (await query(`SELECT ${COLUMNS} FROM admissions WHERE student_id = ?`, [studentId], conn))[0] ?? null
  );
}

export async function insertApplication(studentId, { gradeLevel, previousSchool }, conn) {
  await run(
    'INSERT INTO admissions (student_id, grade_level, previous_school) VALUES (?, ?, ?)',
    [studentId, gradeLevel, previousSchool ?? null],
    conn,
  );
}

const CHECKLIST_COLUMNS = {
  birthCertificateReceived: 'birth_certificate_received',
  reportCardReceived: 'report_card_received',
};

export async function updateChecklist(studentId, fields) {
  const set = buildSet(CHECKLIST_COLUMNS, fields);
  if (!set) return;
  await run(`UPDATE admissions SET ${set.sql} WHERE student_id = ?`, [...set.params, studentId]);
}

/** Declines a pending application; returns false when there is none, or it is no longer pending. */
export async function declinePending(studentId, reason) {
  const result = await run(
    "UPDATE admissions SET status = 'declined', decline_reason = ? WHERE student_id = ? AND status = 'pending'",
    [reason, studentId],
  );
  return result.affectedRows > 0;
}

/** Marks the applications of these students admitted (students without one are untouched). */
export async function markAdmitted(studentIds, conn) {
  await run(
    `UPDATE admissions SET status = 'admitted', decline_reason = NULL
      WHERE student_id IN (?) AND status <> 'admitted'`,
    [studentIds],
    conn,
  );
}

export async function deleteByUserId(userId, conn) {
  await run(
    'DELETE ad FROM admissions ad JOIN students s ON s.id = ad.student_id WHERE s.user_id = ?',
    [userId],
    conn,
  );
}
