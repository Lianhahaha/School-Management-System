import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './activity.controller.js';
import * as schemas from './activity.schemas.js';

export const activityRoutes = Router();

activityRoutes.get('/', authorize('admin'), validate({ query: schemas.listActivityQuery }), controller.list);
