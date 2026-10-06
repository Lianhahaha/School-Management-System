import {
  BooksIcon,
  ChalkboardTeacherIcon,
  IdentificationBadgeIcon,
  StudentIcon,
  UserCircleDashedIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { StatTile } from '../../../components/ui/StatTile';
import { currentAcademicYear } from '../../../utils/date';

/**
 * The six school-wide figures of the admin dashboard (payload `counts`). Each tile opens its list
 * filtered the way the figure is counted (active accounts and subjects, the current academic year's
 * classes). Each icon chip carries its area's mark (people maroon, classes and subjects cream); the
 * unenrolled chip turns oxblood while students are waiting for a class and sage once everyone has one.
 */
export function AdminCountTiles({ counts }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      <StatTile
        label="Students"
        value={counts.students}
        hint="Active"
        icon={StudentIcon}
        mark="maroon"
        to="/admin/students?isActive=true"
      />
      <StatTile
        label="Teachers"
        value={counts.teachers}
        hint="Active"
        icon={ChalkboardTeacherIcon}
        mark="cream"
        to="/admin/teachers?isActive=true"
      />
      <StatTile
        label="Classes"
        value={counts.classes}
        hint="Current academic year"
        icon={UsersThreeIcon}
        mark="cream"
        to={`/admin/classes?academicYear=${currentAcademicYear()}`}
      />
      <StatTile
        label="Subjects"
        value={counts.subjects}
        hint="Active"
        icon={BooksIcon}
        mark="cream"
        to="/admin/subjects?isActive=true"
      />
      <StatTile
        label="Active enrollments"
        value={counts.activeEnrollments}
        icon={IdentificationBadgeIcon}
        mark="maroon"
        to="/admin/students?hasActiveEnrollment=true"
      />
      <StatTile
        label="Unenrolled students"
        value={counts.unenrolledStudents}
        hint={counts.unenrolledStudents > 0 ? 'Need a class' : 'Everyone has a class'}
        icon={UserCircleDashedIcon}
        mark={counts.unenrolledStudents > 0 ? 'oxblood' : 'sage'}
        to="/admin/students?hasActiveEnrollment=false&isActive=true"
      />
    </div>
  );
}
