/**
 * SQL for fees (per school year, for one grade level or every grade: grade_level NULL) and payments. Money
 * is DECIMAL(10,2) and every total is summed by MySQL, so centavos never drift through floating point.
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

/** `gradeLevel` sorts on grade_key, so the every-grade fees (0) come before Grade 1. */
export const FEE_SORT_MAP = { name: 'f.name', amount: 'f.amount', gradeLevel: 'f.grade_key' };

const FEE_COLUMNS = 'f.id, f.academic_year, f.grade_level, f.name, f.amount, f.created_at, f.updated_at';

/** The fees a student of `gradeLevel` pays: that grade's and the every-grade ones (only those for null). */
const APPLIES_TO_GRADE = '(f.grade_level IS NULL OR f.grade_level = ?)';

export async function findFeeById(id) {
  return (await query(`SELECT ${FEE_COLUMNS} FROM fees f WHERE f.id = ?`, [id]))[0] ?? null;
}

/** Newest school year first, then every-grade fees, then by grade and name. */
export function listFees(listQuery) {
  const where = new WhereBuilder()
    .addIf(listQuery.academicYear, 'f.academic_year = ?')
    .addIf(listQuery.gradeLevel, APPLIES_TO_GRADE);
  return selectPage({
    select: FEE_COLUMNS,
    from: 'FROM fees f',
    where,
    listQuery,
    sortMap: FEE_SORT_MAP,
    defaultOrder: 'f.academic_year DESC, f.grade_key ASC, f.name ASC',
    tieBreaker: 'f.id',
  });
}

export async function insertFee({ academicYear, gradeLevel, name, amount }) {
  const result = await run(
    'INSERT INTO fees (academic_year, grade_level, name, amount) VALUES (?, ?, ?, ?)',
    [academicYear, gradeLevel ?? null, name, amount],
  );
  return result.insertId;
}

const FEE_PATCH_COLUMNS = {
  academicYear: 'academic_year',
  gradeLevel: 'grade_level',
  name: 'name',
  amount: 'amount',
};

export async function updateFee(id, fields) {
  const set = buildSet(FEE_PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE fees SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

export async function deleteFee(id) {
  return (await run('DELETE FROM fees WHERE id = ?', [id])).affectedRows;
}

/**
 * The student (null when there is none) with the class they were in last during `academicYear`, whatever
 * the enrollment's status (a student who moved class mid-year counts in the second one); the class columns
 * are null when they had none that year.
 */
export async function findStudentClassInYear(studentId, academicYear) {
  const rows = await query(
    `SELECT s.id AS student_id, c.id AS class_id, c.name AS class_name, c.grade_level
       FROM students s
       LEFT JOIN (enrollments e JOIN classes c ON c.id = e.class_id AND c.academic_year = ?)
         ON e.student_id = s.id
      WHERE s.id = ?
      ORDER BY e.enrolled_on DESC, e.id DESC
      LIMIT 1`,
    [academicYear, studentId],
  );
  return rows[0] ?? null;
}

/** The fees of `academicYear` that a student of `gradeLevel` (null: no class) pays, by name. */
export function findFeesFor(academicYear, gradeLevel) {
  return query(
    `SELECT f.id, f.grade_level, f.name, f.amount FROM fees f
      WHERE f.academic_year = ? AND ${APPLIES_TO_GRADE}
      ORDER BY f.name, f.id`,
    [academicYear, gradeLevel],
  );
}

/** `{ totalFees, totalPaid, balance }` of a student's school year; the balance is negative when they overpaid. */
export async function findTotals(studentId, academicYear, gradeLevel) {
  const rows = await query(
    `SELECT t.total_fees, t.total_paid, t.total_fees - t.total_paid AS balance
       FROM (SELECT
               (SELECT COALESCE(SUM(f.amount), 0) FROM fees f
                 WHERE f.academic_year = ? AND ${APPLIES_TO_GRADE}) AS total_fees,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
                 WHERE p.student_id = ? AND p.academic_year = ?) AS total_paid) t`,
    [academicYear, gradeLevel, studentId, academicYear],
  );
  return rows[0];
}

const PAYMENT_COLUMNS =
  'p.id, p.student_id, p.academic_year, p.amount, p.paid_on, p.method, p.receipt_number, p.note, p.created_at';

/** A payment with its student's number and name (for the activity log), or null. */
export async function findPaymentById(id) {
  const rows = await query(
    `SELECT ${PAYMENT_COLUMNS}, s.student_number, u.first_name, u.last_name
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN users u ON u.id = s.user_id
      WHERE p.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** A student's payments towards `academicYear`, latest first. */
export function findPayments(studentId, academicYear) {
  return query(
    `SELECT ${PAYMENT_COLUMNS} FROM payments p
      WHERE p.student_id = ? AND p.academic_year = ?
      ORDER BY p.paid_on DESC, p.id DESC`,
    [studentId, academicYear],
  );
}

export async function insertPayment(
  { studentId, academicYear, amount, paidOn, method, receiptNumber, note },
  recordedBy,
) {
  const result = await run(
    `INSERT INTO payments (student_id, academic_year, amount, paid_on, method, receipt_number, note, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, academicYear, amount, paidOn, method, receiptNumber, note ?? null, recordedBy],
  );
  return result.insertId;
}

export async function deletePayment(id) {
  return (await run('DELETE FROM payments WHERE id = ?', [id])).affectedRows;
}
