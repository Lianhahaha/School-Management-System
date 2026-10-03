import { BookOpen, BookUser, GraduationCap, School, UserCheck, UserX } from 'lucide-react';
import { StatTile } from '../../../components/ui/StatTile';

/**
 * The six school-wide figures of the admin dashboard (payload `counts`). Each tile opens its list;
 * the unenrolled count turns amber while it is above zero and opens the students without a class.
 */
export function AdminCountTiles({ counts }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatTile label="Students" value={counts.students} icon={GraduationCap} to="/admin/students" />
      <StatTile label="Teachers" value={counts.teachers} icon={BookUser} tone="violet" to="/admin/teachers" />
      <StatTile
        label="Classes"
        value={counts.classes}
        hint="Current academic year"
        icon={School}
        tone="blue"
        to="/admin/classes"
      />
      <StatTile
        label="Subjects"
        value={counts.subjects}
        hint="Active"
        icon={BookOpen}
        tone="gray"
        to="/admin/subjects"
      />
      <StatTile
        label="Active enrollments"
        value={counts.activeEnrollments}
        icon={UserCheck}
        tone="green"
        to="/admin/students?hasActiveEnrollment=true"
      />
      <StatTile
        label="Unenrolled students"
        value={counts.unenrolledStudents}
        hint={counts.unenrolledStudents > 0 ? 'Need a class' : 'Everyone has a class'}
        icon={UserX}
        tone={counts.unenrolledStudents > 0 ? 'amber' : 'green'}
        to="/admin/students?hasActiveEnrollment=false"
      />
    </div>
  );
}
