import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { AuthLayout } from '../components/layout/AuthLayout';
import { PublicOnly } from './guards/PublicOnly';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { RoleRedirect } from './guards/RoleRedirect';
import RouteErrorPage from './pages/RouteErrorPage';

/**
 * One lazy chunk per page. `load` is a dynamic import of a module whose default export is the
 * page; the Suspense boundaries are in AppShell and AuthLayout. Call it once per page and reuse
 * the element where a page is mounted on several routes.
 */
const page = (load) => {
  const Page = lazy(load);
  return <Page />;
};

// Pages shared by the admin and teacher areas: one component each, mounted on two routes.
const attendanceMarkPage = page(() => import('../features/attendance/pages/AttendanceMarkPage'));
const assessmentsPage = page(() => import('../features/grades/pages/AssessmentsPage'));
const gradeSheetPage = page(() => import('../features/grades/pages/GradeSheetPage'));
const announcementsPage = page(() => import('../features/announcements/pages/AnnouncementsPage'));
const calendarPage = page(() => import('../features/calendar/pages/CalendarPage'));

const publicRoutes = [
  { path: 'login', element: page(() => import('../features/auth/pages/LoginPage')) },
  { path: 'register', element: page(() => import('../features/auth/pages/RegisterPage')) },
  { path: 'forgot-password', element: page(() => import('../features/auth/pages/ForgotPasswordPage')) },
];

/**
 * The office's area: the admin and the student assistant share every page except those nested in an
 * admin-only RequireRole; within a page, `can` (utils/roles) hides the actions an assistant may not take.
 */
const adminRoutes = [
  { index: true, element: page(() => import('../features/dashboard/pages/AdminDashboardPage')) },
  {
    path: 'users',
    element: <RequireRole roles={['admin']} />,
    children: [{ index: true, element: page(() => import('../features/users/pages/UsersListPage')) }],
  },
  { path: 'students', element: page(() => import('../features/students/pages/StudentsListPage')) },
  {
    path: 'students/:studentId',
    element: page(() => import('../features/students/pages/StudentDetailPage')),
  },
  { path: 'admissions', element: page(() => import('../features/admissions/pages/AdmissionsPage')) },
  {
    path: 'assistant-requests',
    element: page(() => import('../features/assistantRequests/pages/AssistantRequestsPage')),
  },
  { path: 'teachers', element: page(() => import('../features/teachers/pages/TeachersListPage')) },
  {
    path: 'teachers/:teacherId',
    element: page(() => import('../features/teachers/pages/TeacherDetailPage')),
  },
  { path: 'subjects', element: page(() => import('../features/subjects/pages/SubjectsPage')) },
  { path: 'classes', element: page(() => import('../features/classes/pages/ClassesListPage')) },
  { path: 'classes/:classId', element: page(() => import('../features/classes/pages/ClassDetailPage')) },
  { path: 'attendance', element: attendanceMarkPage },
  { path: 'grades', element: assessmentsPage },
  { path: 'grades/assessments/:assessmentId', element: gradeSheetPage },
  { path: 'announcements', element: announcementsPage },
  { path: 'calendar', element: calendarPage },
  { path: 'activity', element: page(() => import('../features/activity/pages/ActivityPage')) },
];

const teacherRoutes = [
  { index: true, element: page(() => import('../features/dashboard/pages/TeacherDashboardPage')) },
  { path: 'classes', element: page(() => import('../features/classSubjects/pages/MyClassesPage')) },
  {
    path: 'classes/:classSubjectId',
    element: page(() => import('../features/classSubjects/pages/ClassSubjectPage')),
  },
  { path: 'schedule', element: page(() => import('../features/schedules/pages/TeacherSchedulePage')) },
  { path: 'attendance', element: attendanceMarkPage },
  { path: 'grades', element: assessmentsPage },
  { path: 'grades/assessments/:assessmentId', element: gradeSheetPage },
  { path: 'announcements', element: announcementsPage },
  { path: 'calendar', element: calendarPage },
];

const studentRoutes = [
  { index: true, element: page(() => import('../features/dashboard/pages/StudentDashboardPage')) },
  { path: 'class', element: page(() => import('../features/classes/pages/MyClassPage')) },
  { path: 'schedule', element: page(() => import('../features/schedules/pages/StudentSchedulePage')) },
  { path: 'attendance', element: page(() => import('../features/attendance/pages/StudentAttendancePage')) },
  { path: 'grades', element: page(() => import('../features/grades/pages/StudentGradesPage')) },
  {
    path: 'announcements',
    element: page(() => import('../features/announcements/pages/StudentAnnouncementsPage')),
  },
  { path: 'calendar', element: calendarPage },
];

/**
 * The route tree. Guards are layout routes, so a page cannot be added without one:
 *   PublicOnly > AuthLayout                         sign in, register, forgot password
 *   RequireAuth > AppShell > RequireRole(role)      everything else (admin-only pages nest a second one)
 * `*` sits inside the shell, so a signed-out visitor who mistypes a URL is sent to /login first. A student
 * assistant whose sign-up is not approved never gets past RequireAuth: it shows them a waiting screen.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [{ element: <AuthLayout />, children: publicRoutes }],
      },
      // Open to everyone, signed in or not.
      {
        element: <AuthLayout wide />,
        children: [{ path: 'privacy', element: page(() => import('../features/privacy/pages/PrivacyPage')) }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // On a pathless child, not on the shell itself: an errorElement replaces its own route's
                // element, so here a failing page keeps the sidebar and top bar and the user can move on.
                errorElement: <RouteErrorPage />,
                children: [
                  { index: true, element: <RoleRedirect /> },
                  { path: 'profile', element: page(() => import('../features/profile/pages/ProfilePage')) },
                  { path: 'help', element: page(() => import('../features/help/pages/HelpPage')) },
                  { path: '403', element: page(() => import('./pages/ForbiddenPage')) },
                  {
                    path: 'admin',
                    element: <RequireRole roles={['admin', 'assistant']} />,
                    children: adminRoutes,
                  },
                  { path: 'teacher', element: <RequireRole roles={['teacher']} />, children: teacherRoutes },
                  { path: 'student', element: <RequireRole roles={['student']} />, children: studentRoutes },
                  { path: '*', element: page(() => import('./pages/NotFoundPage')) },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
