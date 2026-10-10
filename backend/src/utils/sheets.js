/**
 * Bulk-entry sheets: the attendance sheet of one lesson and date (a status per student) and the grade sheet of
 * one assessment (a score per student) are saved the same way. Inside the save's transaction, after the lock
 * that makes saves of one sheet wait for each other, every row must be a student on the sheet's roster (400
 * not_enrolled), and every row that carries `previous` (what the client saw) must still match the stored entry
 * (409 sheet_changed). After the save, each new or edited entry is logged with its value before.
 * `field` names the value a sheet records: 'status' or 'score'. Row remarks are already blank-as-null
 * (remarksOf) when they reach these helpers.
 */
import { ApiError } from './ApiError.js';

/** Blank remarks are no remarks: '' and null compare and store the same. */
export const remarksOf = (value) => value || null;

/** True when the stored entry (or its absence) is what the client saw (`previous[field]` null = none yet). */
const isAsSeen = (previous, stored, field) =>
  previous[field] === null
    ? stored === undefined
    : stored !== undefined &&
      stored[field] === previous[field] &&
      remarksOf(stored.remarks) === remarksOf(previous.remarks);

/**
 * 400 not_enrolled listing the students of `rows` who are not among `rosterIds`, the students the sheet may
 * record. `message` names the roster in the sheet's own words.
 */
export function assertOnRoster(rows, rosterIds, message) {
  const roster = new Set(rosterIds);
  const invalidStudentIds = rows.map((row) => row.studentId).filter((id) => !roster.has(id));
  if (invalidStudentIds.length) {
    throw ApiError.validation(message, undefined, { reason: 'not_enrolled', invalidStudentIds });
  }
}

/**
 * 409 sheet_changed listing the students whose row carries `previous` but whose stored entry no longer matches
 * it: someone saved meanwhile. `stored` maps studentId -> the stored entry, read under the sheet's lock.
 */
export function assertAsSeen(rows, stored, field, message) {
  const changedStudentIds = rows
    .filter((row) => row.previous && !isAsSeen(row.previous, stored.get(row.studentId), field))
    .map((row) => row.studentId);
  if (changedStudentIds.length) {
    throw ApiError.conflict(message, { reason: 'sheet_changed', changedStudentIds });
  }
}

/** True when saving `row` over the stored entry `before` changes its value or its remarks. */
export const isEdited = (before, row, field) =>
  before[field] !== row[field] || remarksOf(before.remarks) !== row.remarks;

/**
 * The activity-log entry of one saved row: the student, the value before (null for a new entry) and after,
 * and the remarks before and after when they changed. `before` is the stored entry, undefined for a new one.
 */
export const changeOf = (row, before, field, student) => ({
  studentId: row.studentId,
  student,
  from: before ? before[field] : null,
  to: row[field],
  ...(before &&
    remarksOf(before.remarks) !== row.remarks && {
      remarks: { from: remarksOf(before.remarks), to: row.remarks },
    }),
});
