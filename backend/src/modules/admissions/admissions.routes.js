/**
 * /admissions (the office): the document checklist of an application. There is no admit or decline route: the
 * student picks a section themselves (POST /enrollments/next-class), or the office enrolls them (POST
 * /enrollments, /enrollments/bulk), and enrolling admits them.
 */
import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admissions.controller.js';
import * as schemas from './admissions.schemas.js';

export const admissionsRoutes = Router();

admissionsRoutes.patch(
  '/:studentId',
  authorize('admin', 'assistant'),
  validate({ params: schemas.studentIdParams, body: schemas.updateChecklistBody }),
  controller.updateChecklist,
);
