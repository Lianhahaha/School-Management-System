import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './subjects.controller.js';
import * as schemas from './subjects.schemas.js';

export const subjectsRoutes = Router();

subjectsRoutes.get('/', validate({ query: schemas.listSubjectsQuery }), controller.list);
// The subject catalogue is the office's (the admin and the student assistant): create, edit (grading rules
// included), retire and delete.
subjectsRoutes.post(
  '/',
  authorize('admin', 'assistant'),
  validate({ body: schemas.createSubjectBody }),
  controller.create,
);
subjectsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
subjectsRoutes.patch(
  '/:id',
  authorize('admin', 'assistant'),
  validate({ params: schemas.idParams, body: schemas.updateSubjectBody }),
  controller.update,
);
subjectsRoutes.delete(
  '/:id',
  authorize('admin', 'assistant'),
  validate({ params: schemas.idParams }),
  controller.remove,
);
