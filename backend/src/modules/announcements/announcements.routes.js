import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './announcements.controller.js';
import * as schemas from './announcements.schemas.js';

export const announcementsRoutes = Router();

announcementsRoutes.get('/', validate({ query: schemas.listAnnouncementsQuery }), controller.list);
announcementsRoutes.post(
  '/',
  authorize('admin', 'teacher'),
  validate({ body: schemas.createAnnouncementBody }),
  controller.create,
);
announcementsRoutes.post('/read', validate({ body: schemas.markReadBody }), controller.markRead);
announcementsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
announcementsRoutes.patch(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams, body: schemas.updateAnnouncementBody }),
  controller.update,
);
announcementsRoutes.delete(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams }),
  controller.remove,
);
