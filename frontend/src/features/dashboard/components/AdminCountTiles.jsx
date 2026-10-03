import { BookOpen, BookUser, GraduationCap, School, UserCheck, UserX } from 'lucide-react';
import { StatTile } from '../../../components/ui/StatTile';

/**
 * The six school-wide figures of the admin dashboard (payload `counts`). Each tile opens its list;
 * only the unenrolled count carries a tone: amber while it is above zero and opens the students without a class.
 */
export function AdminCountTiles({ counts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">
      <StatTile label="Students" value={counts.students} icon={GraduationCap} to="/admin/students" />
      <StatTile label="Teachers" value={counts.teachers} icon={BookUser} to="/admin/teachers" />
      <StatTile
        label="Classes"
        value={counts.classes}
        hint="Current academic year"
        icon={School}
        to="/admin/classes"
      />
      <StatTile label="Subjects" value={counts.subjects} hint="Active" icon={BookOpen} to="/admin/subjects" />
      <StatTile
        label="Active enrollments"
        value={counts.activeEnrollments}
        icon={UserCheck}
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
