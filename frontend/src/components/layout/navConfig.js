/**
 * Navigation entries per role. They mirror the route tree in app/router.jsx: a role sees links only
 * to its own area. This only decides what is shown; RequireRole guards the routes and the backend
 * enforces access. `end` makes a link active only on an exact match (the dashboards).
 * `tab` puts the entry in the phone's bottom tab bar (four per role, the rest sit under "More");
 * `short` is its label there when the full one is too long.
 */
import {
  Award,
  BookOpen,
  BookUser,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  School,
  Users,
} from 'lucide-react';
import { ROLE_HOME } from '../../constants/ui';

export const NAV = Object.freeze({
  admin: [
    { label: 'Dashboard', short: 'Home', to: ROLE_HOME.admin, icon: LayoutDashboard, end: true, tab: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Students', to: '/admin/students', icon: GraduationCap, tab: true },
    { label: 'Teachers', to: '/admin/teachers', icon: BookUser },
    { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
    { label: 'Classes', to: '/admin/classes', icon: School, tab: true },
    { label: 'Attendance', to: '/admin/attendance', icon: ClipboardCheck, tab: true },
    { label: 'Grades', to: '/admin/grades', icon: Award },
    { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  ],
  teacher: [
    { label: 'Dashboard', short: 'Home', to: ROLE_HOME.teacher, icon: LayoutDashboard, end: true, tab: true },
    { label: 'My classes', short: 'Classes', to: '/teacher/classes', icon: School, tab: true },
    { label: 'Schedule', to: '/teacher/schedule', icon: CalendarDays },
    { label: 'Attendance', to: '/teacher/attendance', icon: ClipboardCheck, tab: true },
    { label: 'Grades', to: '/teacher/grades', icon: Award, tab: true },
    { label: 'Announcements', to: '/teacher/announcements', icon: Megaphone },
  ],
  student: [
    { label: 'Dashboard', short: 'Home', to: ROLE_HOME.student, icon: LayoutDashboard, end: true, tab: true },
    { label: 'My class', short: 'Class', to: '/student/class', icon: School },
    { label: 'Schedule', to: '/student/schedule', icon: CalendarDays, tab: true },
    { label: 'Attendance', to: '/student/attendance', icon: ClipboardCheck, tab: true },
    { label: 'Grades', to: '/student/grades', icon: Award, tab: true },
    { label: 'Announcements', to: '/student/announcements', icon: Megaphone },
  ],
});
