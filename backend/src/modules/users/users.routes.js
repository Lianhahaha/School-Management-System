/** /users: admin only (the role gate is applied once, where the router is mounted in routes.js). */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import * as schemas from './users.schemas.js';

export const usersRoutes = Router();

usersRoutes.get('/', validate({ query: schemas.listUsersQuery }), controller.list);
usersRoutes.post('/', validate({ body: schemas.createUserBody }), controller.create);
usersRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
usersRoutes.patch(
  '/:id',
  validate({ params: schemas.idParams, body: schemas.updateUserBody }),
  controller.update,
);
usersRoutes.patch(
  '/:id/status',
  validate({ params: schemas.idParams, body: schemas.statusBody }),
  controller.setStatus,
);
