/**
 * Fees and payments. Administrators set what the school charges in each school year (a fee for one grade
 * level or for every grade) and record what students pay, with the official receipt (OR) number. A
 * student's statement for a year lists the fees of their class's grade plus the every-grade ones, their
 * payments and the balance, which is negative when they paid more than the fees. Admins read any statement
 * and a student reads their own; teachers have no access. A payment is never edited: a mistake is removed
 * (logged) and recorded again.
 */
import { ApiError } from '../../utils/ApiError.js';
import { resolveMe } from '../../utils/resolveMe.js';
import { scopedStudentId } from '../access/access.service.js';
import { changedList, changesOf, nameOf, record } from '../activity/activity.service.js';
import * as repo from './fees.repository.js';

const pesoFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** 5000 -> '₱5,000.00', for the activity log. */
const peso = (amount) => pesoFormatter.format(amount);

const toFeeShape = (row) => ({
  id: row.id,
  academicYear: row.academicYear,
  gradeLevel: row.gradeLevel,
  name: row.name,
  amount: row.amount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPaymentShape = (row) => ({
  id: row.id,
  studentId: row.studentId,
  academicYear: row.academicYear,
  amount: row.amount,
  paidOn: row.paidOn,
  method: row.method,
  receiptNumber: row.receiptNumber,
  note: row.note,
  createdAt: row.createdAt,
});

/** "Tuition (Grade 7, 2026-2027, ₱18,000.00)" for the activity log. */
const describeFee = (fee) =>
  `${fee.name} (${fee.gradeLevel === null ? 'all grades' : `Grade ${fee.gradeLevel}`}, ${fee.academicYear}, ${peso(fee.amount)})`;

const feeFields = ({ academicYear, gradeLevel, name, amount }) => ({
  academicYear,
  gradeLevel,
  name,
  amount,
});

export async function listFees(listQuery) {
  const { rows, meta } = await repo.listFees(listQuery);
  return { data: rows.map(toFeeShape), meta };
}

async function getFee(id) {
  return toFeeShape(ApiError.assertFound(await repo.findFeeById(id), 'fee', id));
}

/** A second fee with the same name for the same year and grade (or every grade) is a 409 on uq_fees_year_grade_name. */
export async function createFee(body) {
  const fee = await getFee(await repo.insertFee(body));
  await record({
    action: 'fee.create',
    entityId: fee.id,
    summary: `Added the fee ${describeFee(fee)}`,
    details: feeFields(fee),
  });
  return fee;
}

export async function updateFee(id, patch) {
  const existing = await getFee(id);
  await repo.updateFee(id, patch);
  const fee = await getFee(id);
  const changes = changesOf(existing, patch);
  if (changes) {
    await record({
      action: 'fee.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of the fee ${describeFee(fee)}`,
      details: { changes },
    });
  }
  return fee;
}

/** Nothing refers to a fee (payments count towards a school year), so it can always go. */
export async function deleteFee(id) {
  const existing = await getFee(id);
  if (!(await repo.deleteFee(id))) throw ApiError.notFound('fee', id);
  await record({
    action: 'fee.delete',
    entityId: id,
    summary: `Removed the fee ${describeFee(existing)}`,
    details: feeFields(existing),
  });
  return { id };
}

/**
 * A student's fees, payments and balance for one school year. The grade comes from the class they were in
 * last that year; without one, only the every-grade fees apply. `studentId` may be `me`; a student asking
 * for someone else is a 403.
 */
export async function getStatement(user, { studentId, academicYear }) {
  const id = scopedStudentId(user, resolveMe(user, studentId, 'student'));
  const student = ApiError.assertFound(await repo.findStudentClassInYear(id, academicYear), 'student', id);
  const gradeLevel = student.gradeLevel ?? null;
  const [fees, payments, totals] = await Promise.all([
    repo.findFeesFor(academicYear, gradeLevel),
    repo.findPayments(id, academicYear),
    repo.findTotals(id, academicYear, gradeLevel),
  ]);
  return {
    studentId: id,
    academicYear,
    class: student.classId ? { id: student.classId, name: student.className, gradeLevel } : null,
    fees: fees.map((fee) => ({ id: fee.id, name: fee.name, gradeLevel: fee.gradeLevel, amount: fee.amount })),
    payments: payments.map(toPaymentShape),
    totalFees: totals.totalFees,
    totalPaid: totals.totalPaid,
    balance: totals.balance,
  };
}

const paymentFields = (payment) => ({
  studentNumber: payment.studentNumber,
  academicYear: payment.academicYear,
  amount: payment.amount,
  paidOn: payment.paidOn,
  method: payment.method,
  receiptNumber: payment.receiptNumber,
  note: payment.note,
});

/** A receipt number already used is a 409 on uq_payments_receipt; an unknown student a 400 (the foreign key). */
export async function recordPayment(user, body) {
  const payment = await repo.findPaymentById(await repo.insertPayment(body, user.id));
  await record({
    action: 'payment.create',
    entityId: payment.id,
    summary: `Recorded ${peso(payment.amount)} (OR ${payment.receiptNumber}) for ${nameOf(payment)}`,
    details: paymentFields(payment),
  });
  return toPaymentShape(payment);
}

/** Deletes a payment recorded by mistake; the activity log keeps what it was. */
export async function deletePayment(id) {
  const payment = ApiError.assertFound(await repo.findPaymentById(id), 'payment', id);
  if (!(await repo.deletePayment(id))) throw ApiError.notFound('payment', id);
  await record({
    action: 'payment.delete',
    entityId: id,
    summary: `Removed the payment of ${peso(payment.amount)} (OR ${payment.receiptNumber}) for ${nameOf(payment)}`,
    details: paymentFields(payment),
  });
  return { id };
}
