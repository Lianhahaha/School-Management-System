/**
 * Two routers: /grades (flat reads, summary, delete) and the roster / bulk entry of one assessment,
 * mounted under /assessments/:id/grades (mergeParams exposes `id`).
 */
import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './grades.controller.js';
import * as schemas from './grades.schemas.js';

export const gradesRoutes = Router();

gradesRoutes.get('/', validate({ query: schemas.listGradesQuery }), controller.list);
gradesRoutes.get('/summary', validate({ query: schemas.gradeSummaryQuery }), controller.summary);
gradesRoutes.delete(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams }),
  controller.remove,
);

export const assessmentGradesRoutes = Router({ mergeParams: true });

assessmentGradesRoutes.get(
  '/',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams }),
  controller.getRoster,
);
assessmentGradesRoutes.put(
  '/',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams, body: schemas.saveGradesBody }),
  controller.saveGrades,
);
