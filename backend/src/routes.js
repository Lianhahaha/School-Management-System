/**
 * The /api/v1 router. Public routes first (health, auth), then every other
 * resource mounted behind `authenticate`. Authentication is applied per mount,
 * not to the router as a whole, so an unknown path reaches the 404 handler
 * whether or not a token was sent. Role gates live next to each route (authorize).
 */
import { Router } from 'express';
import { authenticate } from './middleware/authenticate.js';
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

apiRouter.use('/users', authenticate, usersRoutes);
apiRouter.use('/students', authenticate, studentsRoutes);
apiRouter.use('/teachers', authenticate, teachersRoutes);
apiRouter.use('/subjects', authenticate, subjectsRoutes);
apiRouter.use('/classes', authenticate, classesRoutes);
apiRouter.use('/class-subjects', authenticate, classSubjectsRoutes);
apiRouter.use('/enrollments', authenticate, enrollmentsRoutes);
apiRouter.use('/attendance', authenticate, attendanceRoutes);
// Mounted before /assessments so a roster request is authenticated once, not by both mounts.
apiRouter.use('/assessments/:id/grades', authenticate, assessmentGradesRoutes);
apiRouter.use('/assessments', authenticate, assessmentsRoutes);
apiRouter.use('/grades', authenticate, gradesRoutes);
apiRouter.use('/schedules', authenticate, schedulesRoutes);
apiRouter.use('/announcements', authenticate, announcementsRoutes);
apiRouter.use('/dashboard', authenticate, dashboardRoutes);
