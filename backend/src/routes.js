/**
 * The /api/v1 router. Public routes first (health, auth), then `authenticate`
 * guards everything below it. Role gates live next to each route (authorize),
 * except /users which is admin-only as a whole.
 */
import { Router } from 'express';
import { authenticate } from './middleware/authenticate.js';
import { authorize } from './middleware/authorize.js';
import { announcementsRoutes } from './modules/announcements/announcements.routes.js';
import { assessmentsRoutes } from './modules/assessments/assessments.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { classesRoutes } from './modules/classes/classes.routes.js';
import { classSubjectsRoutes } from './modules/classSubjects/classSubjects.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { enrollmentsRoutes } from './modules/enrollments/enrollments.routes.js';
import { assessmentGradesRoutes, gradesRoutes } from './modules/grades/grades.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { schedulesRoutes } from './modules/schedules/schedules.routes.js';
import { studentsRoutes } from './modules/students/students.routes.js';
import { subjectsRoutes } from './modules/subjects/subjects.routes.js';
import { teachersRoutes } from './modules/teachers/teachers.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);

apiRouter.use(authenticate);
apiRouter.use('/users', authorize('admin'), usersRoutes);
apiRouter.use('/students', studentsRoutes);
apiRouter.use('/teachers', teachersRoutes);
apiRouter.use('/subjects', subjectsRoutes);
apiRouter.use('/classes', classesRoutes);
apiRouter.use('/class-subjects', classSubjectsRoutes);
apiRouter.use('/enrollments', enrollmentsRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/assessments', assessmentsRoutes);
apiRouter.use('/assessments/:id/grades', assessmentGradesRoutes);
apiRouter.use('/grades', gradesRoutes);
apiRouter.use('/schedules', schedulesRoutes);
apiRouter.use('/announcements', announcementsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
