import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './calendar.controller.js';
import * as schemas from './calendar.schemas.js';

export const calendarRoutes = Router();

calendarRoutes.get('/', validate({ query: schemas.listEventsQuery }), controller.list);
calendarRoutes.post('/', authorize('admin'), validate({ body: schemas.createEventBody }), controller.create);
calendarRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
calendarRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateEventBody }),
  controller.update,
);
calendarRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);
