import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './schedules.controller.js';
import * as schemas from './schedules.schemas.js';

export const schedulesRoutes = Router();

schedulesRoutes.get('/', validate({ query: schemas.listSchedulesQuery }), controller.list);
schedulesRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: schemas.createScheduleBody }),
  controller.create,
);
schedulesRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
schedulesRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateScheduleBody }),
  controller.update,
);
schedulesRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);
