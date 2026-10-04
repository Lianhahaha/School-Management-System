import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import * as schemas from './users.schemas.js';

export const usersRoutes = Router();

usersRoutes.get('/', authorize('admin'), validate({ query: schemas.listUsersQuery }), controller.list);
usersRoutes.post('/', authorize('admin'), validate({ body: schemas.createUserBody }), controller.create);
usersRoutes.get('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.get);
usersRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateUserBody }),
  controller.update,
);
usersRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);
usersRoutes.patch(
  '/:id/status',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.statusBody }),
  controller.setStatus,
);
