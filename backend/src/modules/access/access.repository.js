/**
 * The EXISTS queries behind every ownership / visibility rule, and the class
 * membership rule that every dated roster (attendance sheet, grade roster)
 * is built on. No other repository writes scoping SQL; services call
 * access.service instead.
 */
import { query } from '../../config/db.js';

/**
 * Condition on an `enrollments e` row: its student was in class `classSql` on day `daySql` — enrolled on or
 * before that day and not yet left, so a student who changes class on day D belongs to the new class on D.
 * For today this is exactly the active enrollments. Both arguments are SQL expressions of the enclosing query
 * (columns, or `?`; a `?` day is bound twice).
 */
export const enrolledInClassOn = (classSql, daySql) =>
  `e.class_id = ${classSql} AND e.enrolled_on <= ${daySql} AND (e.left_on IS NULL OR e.left_on > ${daySql})`;

/**
 * Sub-select of the class ids a teacher can see: classes where they teach a
 * subject, plus classes where they are the homeroom teacher. Takes the teacher
 * id twice as parameters (see visibleClassParams).
 */
export const VISIBLE_CLASS_IDS_SQL = `(
  SELECT cs.class_id FROM class_subjects cs WHERE cs.teacher_id = ?
  UNION
  SELECT c.id FROM classes c WHERE c.homeroom_teacher_id = ?
)`;

export const visibleClassParams = (teacherId) => [teacherId, teacherId];

const exists = async (sql, params) => (await query(sql, params)).length > 0;

export const teacherCanViewClass = (teacherId, classId) =>
  exists(`SELECT 1 AS ok FROM classes c WHERE c.id = ? AND c.id IN ${VISIBLE_CLASS_IDS_SQL}`, [
    classId,
    ...visibleClassParams(teacherId),
  ]);

export const teacherCanViewClassSubject = (teacherId, classSubjectId) =>
  exists(
    `SELECT 1 AS ok FROM class_subjects cs WHERE cs.id = ? AND cs.class_id IN ${VISIBLE_CLASS_IDS_SQL}`,
    [classSubjectId, ...visibleClassParams(teacherId)],
  );

export const teacherOwnsClassSubject = (teacherId, classSubjectId) =>
  exists('SELECT 1 AS ok FROM class_subjects WHERE id = ? AND teacher_id = ?', [classSubjectId, teacherId]);

export const teacherCanViewStudent = (teacherId, studentId) =>
  exists(
    `SELECT 1 AS ok FROM enrollments e
      WHERE e.student_id = ? AND e.status = 'active' AND e.class_id IN ${VISIBLE_CLASS_IDS_SQL}`,
    [studentId, ...visibleClassParams(teacherId)],
  );

/** Class id of a class-subject, or null when it does not exist. */
export async function classIdOfClassSubject(classSubjectId) {
  const rows = await query('SELECT class_id FROM class_subjects WHERE id = ?', [classSubjectId]);
  return rows[0]?.classId ?? null;
}
