/**
 * Look-ups an import checks its rows against, in one query each for the whole batch.
 */
import { query } from '../../config/db.js';

/** The ones among `emails` that already belong to an account (lower-cased). */
export async function findTakenEmails(emails) {
  if (!emails.length) return new Set();
  const rows = await query('SELECT LOWER(email) AS email FROM users WHERE email IN (?)', [emails]);
  return new Set(rows.map((row) => row.email));
}

/** The ones among `numbers` already issued to a student. */
export async function findTakenStudentNumbers(numbers) {
  if (!numbers.length) return new Set();
  const rows = await query('SELECT student_number FROM students WHERE student_number IN (?)', [numbers]);
  return new Set(rows.map((row) => row.studentNumber));
}

/** Map lower-cased class name -> `{ id, name }`, for the classes of one academic year. */
export async function findClassesByName(academicYear) {
  const rows = await query('SELECT id, name FROM classes WHERE academic_year = ?', [academicYear]);
  return new Map(rows.map((row) => [row.name.toLowerCase(), row]));
}
