import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './classSubjects.controller.js';
import * as schemas from './classSubjects.schemas.js';

export const classSubjectsRoutes = Router();

classSubjectsRoutes.get('/', validate({ query: schemas.listClassSubjectsQuery }), controller.list);
classSubjectsRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: schemas.createClassSubjectBody }),
  controller.create,
);
classSubjectsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
classSubjectsRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.reassignBody }),
  controller.reassign,
);
classSubjectsRoutes.delete(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams }),
  controller.remove,
);
