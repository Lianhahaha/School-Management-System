/**
 * /assistant-requests (the school office: an admin or an approved student assistant; `authenticate` has already
 * turned away an assistant who is not approved): the sign-ups of student assistants, approving and declining them.
 */
import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './assistantRequests.controller.js';
import * as schemas from './assistantRequests.schemas.js';

export const assistantRequestsRoutes = Router();

assistantRequestsRoutes.get(
  '/',
  authorize('admin', 'assistant'),
  validate({ query: schemas.listAssistantRequestsQuery }),
  controller.list,
);
assistantRequestsRoutes.post(
  '/:userId/approve',
  authorize('admin', 'assistant'),
  validate({ params: schemas.userIdParams }),
  controller.approve,
);
assistantRequestsRoutes.post(
  '/:userId/decline',
  authorize('admin', 'assistant'),
  validate({ params: schemas.userIdParams, body: schemas.declineBody }),
  controller.decline,
);
