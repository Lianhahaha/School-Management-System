import { BookOpen, BookUser, GraduationCap, School, UserCheck, UserX } from 'lucide-react';
import { StatTile } from '../../../components/ui/StatTile';
import { currentAcademicYear } from '../../../utils/date';

/**
 * The six school-wide figures of the admin dashboard (payload `counts`). Each tile opens its list
 * filtered the way the figure is counted (active accounts and subjects, the current academic year's
 * classes). Each icon chip carries its area's mark (students slate, teaching plum, classes umber); the
 * unenrolled chip turns brick while students are waiting for a class and leaf once everyone has one.
 */
export function AdminCountTiles({ counts }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      <StatTile
        label="Students"
        value={counts.students}
        hint="Active"
        icon={GraduationCap}
        mark="slate"
        to="/admin/students?isActive=true"
      />
      <StatTile
        label="Teachers"
        value={counts.teachers}
        hint="Active"
        icon={BookUser}
        mark="plum"
        to="/admin/teachers?isActive=true"
      />
      <StatTile
        label="Classes"
        value={counts.classes}
        hint="Current academic year"
        icon={School}
        mark="umber"
        to={`/admin/classes?academicYear=${currentAcademicYear()}`}
      />
      <StatTile
        label="Subjects"
        value={counts.subjects}
        hint="Active"
        icon={BookOpen}
        mark="plum"
        to="/admin/subjects?isActive=true"
      />
      <StatTile
        label="Active enrollments"
        value={counts.activeEnrollments}
        icon={UserCheck}
        mark="slate"
        to="/admin/students?hasActiveEnrollment=true"
      />
      <StatTile
        label="Unenrolled students"
        value={counts.unenrolledStudents}
        hint={counts.unenrolledStudents > 0 ? 'Need a class' : 'Everyone has a class'}
        icon={UserX}
        mark={counts.unenrolledStudents > 0 ? 'brick' : 'leaf'}
        to="/admin/students?hasActiveEnrollment=false&isActive=true"
      />
    </div>
  );
}
