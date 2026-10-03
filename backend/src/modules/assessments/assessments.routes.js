import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './assessments.controller.js';
import * as schemas from './assessments.schemas.js';

export const assessmentsRoutes = Router();

assessmentsRoutes.get('/', validate({ query: schemas.listAssessmentsQuery }), controller.list);
assessmentsRoutes.post(
  '/',
  authorize('admin', 'teacher'),
  validate({ body: schemas.createAssessmentBody }),
  controller.create,
);
assessmentsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
assessmentsRoutes.patch(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams, body: schemas.updateAssessmentBody }),
  controller.update,
);
assessmentsRoutes.delete(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams }),
  controller.remove,
);
