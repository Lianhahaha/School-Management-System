/**
 * Aggregate queries that belong to no other module. Everything else on the dashboards is
 * composed from the owning modules' services.
 */
import { query } from '../../config/db.js';

export async function findAdminCounts(academicYear) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 1) AS students,
       (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1) AS teachers,
       (SELECT COUNT(*) FROM classes WHERE academic_year = ?) AS classes,
       (SELECT COUNT(*) FROM subjects WHERE is_active = 1) AS subjects,
       (SELECT COUNT(*) FROM class_subjects cs JOIN classes c ON c.id = cs.class_id
         WHERE c.academic_year = ?) AS teacher_assignments,
       (SELECT COUNT(*) FROM schedules sch
          JOIN class_subjects cs ON cs.id = sch.class_subject_id
          JOIN classes c ON c.id = cs.class_id
         WHERE c.academic_year = ?) AS timetable_slots,
       (SELECT COUNT(*) FROM enrollments WHERE status = 'active') AS active_enrollments,
       (SELECT COUNT(*) FROM students s
          JOIN users u ON u.id = s.user_id
          LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
         WHERE u.is_active = 1 AND e.id IS NULL) AS unenrolled_students`,
    [academicYear, academicYear, academicYear],
  );
  return rows[0];
}

export function findEnrollmentsByGrade() {
  return query(
    `SELECT c.grade_level, COUNT(*) AS students
       FROM enrollments e JOIN classes c ON c.id = e.class_id
      WHERE e.status = 'active'
      GROUP BY c.grade_level ORDER BY c.grade_level`,
  );
}

/** Class-subjects a teacher teaches in an academic year, with the number of enrolled students. */
export function findTeacherClassSubjects(teacherId, academicYear) {
  return query(
    `SELECT cs.id, cs.class_id, c.name AS class_name, sub.name AS subject_name, c.academic_year,
            (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cs.class_id AND e.status = 'active') AS student_count
       FROM class_subjects cs
       JOIN classes c ON c.id = cs.class_id
       JOIN subjects sub ON sub.id = cs.subject_id
      WHERE cs.teacher_id = ? AND c.academic_year = ?
      ORDER BY c.name, sub.name`,
    [teacherId, academicYear],
  );
}
