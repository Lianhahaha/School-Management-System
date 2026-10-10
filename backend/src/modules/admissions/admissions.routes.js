/**
 * /admissions (admin): the document checklist of an application and declining it. There is no admit route:
 * enrolling the applicant in a class (POST /enrollments, /enrollments/bulk) admits them.
 */
import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admissions.controller.js';
import * as schemas from './admissions.schemas.js';

export const admissionsRoutes = Router();

admissionsRoutes.patch(
  '/:studentId',
  authorize('admin'),
  validate({ params: schemas.studentIdParams, body: schemas.updateChecklistBody }),
  controller.updateChecklist,
);
admissionsRoutes.post(
  '/:studentId/decline',
  authorize('admin'),
  validate({ params: schemas.studentIdParams, body: schemas.declineBody }),
  controller.decline,
);
