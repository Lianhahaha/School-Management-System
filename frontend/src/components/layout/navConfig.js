/**
 * Sidebar entries per role. They mirror the route tree in app/router.jsx: a role sees links only to
 * its own area. This only decides what is shown; RequireRole guards the routes and the backend
 * enforces access. `end` makes a link active only on an exact match (the dashboards).
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
    { label: 'Dashboard', to: ROLE_HOME.admin, icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Students', to: '/admin/students', icon: GraduationCap },
    { label: 'Teachers', to: '/admin/teachers', icon: BookUser },
    { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
    { label: 'Classes', to: '/admin/classes', icon: School },
    { label: 'Attendance', to: '/admin/attendance', icon: ClipboardCheck },
    { label: 'Grades', to: '/admin/grades', icon: Award },
    { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  ],
  teacher: [
    { label: 'Dashboard', to: ROLE_HOME.teacher, icon: LayoutDashboard, end: true },
    { label: 'My classes', to: '/teacher/classes', icon: School },
    { label: 'Schedule', to: '/teacher/schedule', icon: CalendarDays },
    { label: 'Attendance', to: '/teacher/attendance', icon: ClipboardCheck },
    { label: 'Grades', to: '/teacher/grades', icon: Award },
    { label: 'Announcements', to: '/teacher/announcements', icon: Megaphone },
  ],
  student: [
    { label: 'Dashboard', to: ROLE_HOME.student, icon: LayoutDashboard, end: true },
    { label: 'My class', to: '/student/class', icon: School },
    { label: 'Schedule', to: '/student/schedule', icon: CalendarDays },
    { label: 'Attendance', to: '/student/attendance', icon: ClipboardCheck },
    { label: 'Grades', to: '/student/grades', icon: Award },
    { label: 'Announcements', to: '/student/announcements', icon: Megaphone },
  ],
});
