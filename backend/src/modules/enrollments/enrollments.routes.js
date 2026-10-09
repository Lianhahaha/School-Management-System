import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './enrollments.controller.js';
import * as schemas from './enrollments.schemas.js';

export const enrollmentsRoutes = Router();

enrollmentsRoutes.get('/', validate({ query: schemas.listEnrollmentsQuery }), controller.list);
enrollmentsRoutes.post('/', authorize('admin'), validate({ body: schemas.enrollBody }), controller.create);
// Fixed sub-paths are declared before '/:id'.
enrollmentsRoutes.post(
  '/bulk',
  authorize('admin'),
  validate({ body: schemas.enrollManyBody }),
  controller.createMany,
);
enrollmentsRoutes.post(
  '/transfer',
  authorize('admin'),
  validate({ body: schemas.transferBody }),
  controller.transfer,
);
enrollmentsRoutes.post(
  '/complete',
  authorize('admin'),
  validate({ body: schemas.completeYearBody }),
  controller.completeYear,
);
// A student without a class: where they stand for next year, and enrolling in an offered section.
enrollmentsRoutes.get('/next-class', authorize('student'), controller.myNextClass);
enrollmentsRoutes.post(
  '/next-class',
  authorize('student'),
  validate({ body: schemas.nextClassBody }),
  controller.enrollMyself,
);
enrollmentsRoutes.get('/:id', validate({ params: schemas.idParams }), controller.get);
enrollmentsRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.setStatusBody }),
  controller.setStatus,
);
