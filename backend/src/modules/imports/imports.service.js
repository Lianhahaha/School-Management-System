/**
 * Bulk import of student accounts from spreadsheet rows. Two steps, both through the same endpoint:
 *
 *   dry run   every row is checked (formats, duplicates within the file, emails and student numbers already
 *             in use, the class name) and the problems are listed per spreadsheet line; nothing is written.
 *   create    the same checks; if any row fails nothing is written (400). Otherwise each row becomes an account
 *             (Firebase + MySQL, through the one account-creation path) with the batch's temporary password,
 *             enrolled in its class when one is named. Accounts are created one at a time, so a failure
 *             half-way (Firebase unreachable) is reported per row and the rows before it stay created.
 *
 * Clients send a large file in several create calls (after one dry run of the whole file) to show progress.
 */
import { ApiError } from '../../utils/ApiError.js';
import { currentAcademicYear } from '../../utils/dates.js';
import { enroll } from '../enrollments/enrollments.service.js';
import { createUserAccount } from '../users/users.service.js';
import * as repo from './imports.repository.js';
import { studentImportRow } from './imports.schemas.js';

/** Cells as typed: trimmed, blank ones dropped, gender in lower case ("Female" works). */
function cleanCells({ line: _line, ...cells }) {
  const values = {};
  for (const [field, raw] of Object.entries(cells)) {
    const value = raw?.trim();
    if (value) values[field] = field === 'gender' ? value.toLowerCase() : value;
  }
  return values;
}

/**
 * Checks every row. Returns the parsed rows (with `classId` resolved) and, per line, its problems:
 * `{ rows: [{ line, data }], problems: [{ line, errors: [{ field, message }] }] }`.
 */
async function checkRows(rawRows) {
  const year = currentAcademicYear();
  const parsed = rawRows.map((raw) => {
    const result = studentImportRow.safeParse(cleanCells(raw));
    const errors = result.success
      ? []
      : result.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message }));
    return { line: raw.line, data: result.success ? result.data : null, errors };
  });

  const valid = parsed.filter((row) => row.data);
  const [takenEmails, takenNumbers, classes] = await Promise.all([
    repo.findTakenEmails(valid.map((row) => row.data.email)),
    repo.findTakenStudentNumbers(valid.map((row) => row.data.studentNumber).filter(Boolean)),
    repo.findClassesByName(year),
  ]);

  const firstLineOf = { email: new Map(), studentNumber: new Map() };
  for (const row of valid) {
    const { email, studentNumber, className } = row.data;
    for (const [field, value] of [
      ['email', email],
      ['studentNumber', studentNumber],
    ]) {
      if (!value) continue;
      const earlier = firstLineOf[field].get(value);
      if (earlier !== undefined) row.errors.push({ field, message: `the same as row ${earlier}` });
      else firstLineOf[field].set(value, row.line);
    }
    if (takenEmails.has(email)) row.errors.push({ field: 'email', message: 'already has an account' });
    if (studentNumber && takenNumbers.has(studentNumber)) {
      row.errors.push({ field: 'studentNumber', message: 'already belongs to a student' });
    }
    if (className) {
      // Matched in any case; the answer reports the class's own spelling.
      const klass = classes.get(className.toLowerCase());
      if (klass) Object.assign(row.data, { classId: klass.id, className: klass.name });
      else row.errors.push({ field: 'className', message: `no class with this name in ${year}` });
    }
  }

  return {
    rows: parsed.filter((row) => row.errors.length === 0),
    problems: parsed.filter((row) => row.errors.length > 0).map(({ line, errors }) => ({ line, errors })),
  };
}

/** Creates one row's account (and enrollment); never throws, the outcome is reported per line. */
async function createRow(row, password) {
  const { email, firstName, lastName, phone, classId, className, ...profile } = row.data;
  let account;
  try {
    account = await createUserAccount(
      { role: 'student', email, password, firstName, lastName, phone, profile },
      { trusted: true },
    );
  } catch (error) {
    return { line: row.line, status: 'failed', message: error.message };
  }
  const created = {
    line: row.line,
    status: 'created',
    studentId: account.studentId,
    studentNumber: account.profile.studentNumber,
    email: account.email,
    className: null,
  };
  if (!classId) return created;
  try {
    await enroll({ studentId: account.studentId, classId });
    return { ...created, className };
  } catch (error) {
    return { ...created, message: `account created, but not enrolled: ${error.message}` };
  }
}

/**
 * @param {{ dryRun: boolean, password?: string, rows: object[] }} body
 * @returns {Promise<{ dryRun: boolean, total: number, valid: number, problems: object[], results?: object[] }>}
 */
export async function importStudents({ dryRun, password, rows: rawRows }) {
  const { rows, problems } = await checkRows(rawRows);
  const report = { dryRun, total: rawRows.length, valid: rows.length, problems };
  if (dryRun) return report;
  if (problems.length) {
    throw ApiError.validation('some rows have problems; nothing was imported', undefined, {
      reason: 'import_invalid',
      problems,
    });
  }
  const results = [];
  for (const row of rows) results.push(await createRow(row, password));
  return { ...report, results };
}
