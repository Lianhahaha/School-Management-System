import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './subjects.controller.js';
import * as schemas from './subjects.schemas.js';

export const subjectsRoutes = Router();

subjectsRoutes.get('/', validate({ query: schemas.listSubjectsQuery }), controller.list);
// The office creates subjects (a student assistant too); editing, retiring and deleting one, which change how
// every class using it is graded, stay the admin's.
subjectsRoutes.post(
  '/',
  authorize('admin', 'assistant'),
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
