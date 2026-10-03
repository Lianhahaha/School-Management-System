/**
 * Tiny response-shape helpers shared by several modules. Row keys are already
 * camelCase (config/db.js camelizes on read); these only group columns that
 * repeat across resources.
 */

/** `{ id, firstName, lastName }` or null when there is no person. */
export const personRef = (id, firstName, lastName) => (id == null ? null : { id, firstName, lastName });

/**
 * `{ classId, className, academicYear, subjectId, subjectName, teacherId }` from any row that selected
 * CLASS_SUBJECT_REF_COLUMNS (see utils/sql.js).
 */
export const classSubjectRef = (row) => ({
  classId: row.classId,
  className: row.className,
  academicYear: row.academicYear,
  subjectId: row.subjectId,
  subjectName: row.subjectName,
  teacherId: row.teacherId,
});

/** Ratio rounded to 4 decimals, or null when the denominator is zero. */
export const ratio = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 10000) / 10000 : null;
