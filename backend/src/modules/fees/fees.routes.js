/**
 * Two routers: /fees (the fees of each school year, and a student's statement) and /payments (recording a
 * payment, and removing one recorded by mistake). Administrators only, except the statement, which a
 * student reads for themselves.
 */
import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './fees.controller.js';
import * as schemas from './fees.schemas.js';

export const feesRoutes = Router();

feesRoutes.get('/', authorize('admin'), validate({ query: schemas.listFeesQuery }), controller.list);
feesRoutes.get(
  '/statement',
  authorize('admin', 'student'),
  validate({ query: schemas.statementQuery }),
  controller.statement,
);
feesRoutes.post('/', authorize('admin'), validate({ body: schemas.createFeeBody }), controller.create);
feesRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateFeeBody }),
  controller.update,
);
feesRoutes.delete('/:id', authorize('admin'), validate({ params: schemas.idParams }), controller.remove);

export const paymentsRoutes = Router();

paymentsRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: schemas.createPaymentBody }),
  controller.recordPayment,
);
paymentsRoutes.delete(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams }),
  controller.removePayment,
);
