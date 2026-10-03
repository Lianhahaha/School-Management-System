/**
 * SQL for class_subjects: the teacher assignment ("teacher T teaches subject S to class C").
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder } from '../../utils/sql.js';

export const CLASS_SUBJECT_SORT_MAP = {
  className: 'c.name',
  subjectName: 'sub.name',
  teacherLastName: 'tu.last_name',
  createdAt: 'cs.created_at',
};

const COLUMNS = `cs.id, cs.class_id, c.name AS class_name, c.academic_year, cs.subject_id,
  sub.code AS subject_code, sub.name AS subject_name, cs.teacher_id,
  tu.first_name AS teacher_first_name, tu.last_name AS teacher_last_name, cs.created_at, cs.updated_at`;

const FROM = `FROM class_subjects cs
  JOIN classes c ON c.id = cs.class_id
  JOIN subjects sub ON sub.id = cs.subject_id
  JOIN teachers t ON t.id = cs.teacher_id
  JOIN users tu ON tu.id = t.user_id`;

export async function findClassSubjectById(id) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE cs.id = ?`, [id]))[0] ?? null;
}

export function listClassSubjects(listQuery, scope) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['sub.name', 'sub.code', 'c.name'])
    .addIf(listQuery.classId, 'cs.class_id = ?')
    .addIf(listQuery.subjectId, 'cs.subject_id = ?')
    .addIf(listQuery.teacherId, 'cs.teacher_id = ?')
    .addIf(listQuery.academicYear, 'c.academic_year = ?')
    .addScope(scope);
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: CLASS_SUBJECT_SORT_MAP,
    defaultOrder: 'c.name ASC, sub.name ASC',
    tieBreaker: 'cs.id',
  });
}

export async function insertClassSubject({ classId, subjectId, teacherId }) {
  const result = await run('INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?)', [
    classId,
    subjectId,
    teacherId,
  ]);
  return result.insertId;
}

export async function updateTeacher(id, teacherId) {
  await run('UPDATE class_subjects SET teacher_id = ? WHERE id = ?', [teacherId, id]);
}

export async function deleteClassSubject(id) {
  return (await run('DELETE FROM class_subjects WHERE id = ?', [id])).affectedRows;
}

/** True when the teacher teaches a subject or is homeroom teacher of a class in the given academic year. */
export async function teacherHasAssignments(teacherId, academicYear, conn) {
  const rows = await query(
    `SELECT 1 AS ok FROM class_subjects cs JOIN classes c ON c.id = cs.class_id
      WHERE cs.teacher_id = ? AND c.academic_year = ?
     UNION
     SELECT 1 FROM classes c WHERE c.homeroom_teacher_id = ? AND c.academic_year = ?
     LIMIT 1`,
    [teacherId, academicYear, teacherId, academicYear],
    conn,
  );
  return rows.length > 0;
}
