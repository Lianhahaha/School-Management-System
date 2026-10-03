import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './subjects.controller.js';
import * as schemas from './subjects.schemas.js';

export const subjectsRoutes = Router();

subjectsRoutes.get('/', validate({ query: schemas.listSubjectsQuery }), controller.list);
subjectsRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: schemas.createSubjectBody }),
  controller.create,
);
subjectsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
subjectsRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateSubjectBody }),
  controller.update,
);
subjectsRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);
