import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as controller from './notifications.controller.js';
import * as schemas from './notifications.schemas.js';

/** Every route reads or changes only the caller's own notifications, whatever their role. */
export const notificationsRoutes = Router();

notificationsRoutes.get('/', validate({ query: schemas.listNotificationsQuery }), controller.list);
notificationsRoutes.get('/unread-count', validate({ query: z.strictObject({}) }), controller.unreadCount);
notificationsRoutes.post('/read', validate({ body: schemas.markReadBody }), controller.markRead);
