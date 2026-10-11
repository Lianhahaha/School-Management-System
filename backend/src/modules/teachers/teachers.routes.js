import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './teachers.controller.js';
import * as schemas from './teachers.schemas.js';

export const teachersRoutes = Router();

teachersRoutes.get(
  '/',
  authorize('admin', 'assistant'),
  validate({ query: schemas.listTeachersQuery }),
  controller.list,
);
teachersRoutes.get(
  '/:id',
  authorize('admin', 'assistant', 'teacher'),
  validate({ params: schemas.idOrMeParams }),
  controller.get,
);
teachersRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateTeacherBody }),
  controller.update,
);
