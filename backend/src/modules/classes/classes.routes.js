import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './classes.controller.js';
import * as schemas from './classes.schemas.js';

export const classesRoutes = Router();

classesRoutes.get('/', validate({ query: schemas.listClassesQuery }), controller.list);
classesRoutes.post('/', authorize('admin'), validate({ body: schemas.createClassBody }), controller.create);
classesRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
classesRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateClassBody }),
  controller.update,
);
classesRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);
