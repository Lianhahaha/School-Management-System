import { BookOpen, BookUser, GraduationCap, School, UserCheck, UserX } from 'lucide-react';
import { StatTile } from '../../../components/ui/StatTile';
import { currentAcademicYear } from '../../../utils/date';

/**
 * The six school-wide figures of the admin dashboard (payload `counts`). Each tile opens its list
 * filtered the way the figure is counted (active accounts and subjects, the current academic year's
 * classes); only the unenrolled count carries a tone: amber while it is above zero.
 */
export function AdminCountTiles({ counts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">
      <StatTile
        label="Students"
        value={counts.students}
        hint="Active"
        icon={GraduationCap}
        to="/admin/students?isActive=true"
      />
      <StatTile
        label="Teachers"
        value={counts.teachers}
        hint="Active"
        icon={BookUser}
        to="/admin/teachers?isActive=true"
      />
      <StatTile
        label="Classes"
        value={counts.classes}
        hint="Current academic year"
        icon={School}
        to={`/admin/classes?academicYear=${currentAcademicYear()}`}
      />
      <StatTile
        label="Subjects"
        value={counts.subjects}
        hint="Active"
        icon={BookOpen}
        to="/admin/subjects?isActive=true"
      />
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
        to="/admin/students?hasActiveEnrollment=false&isActive=true"
      />
    </div>
  );
}
