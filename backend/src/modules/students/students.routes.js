import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './students.controller.js';
import * as schemas from './students.schemas.js';

export const studentsRoutes = Router();

studentsRoutes.get(
  '/',
  authorize('admin', 'teacher'),
  validate({ query: schemas.listStudentsQuery }),
  controller.list,
);
studentsRoutes.get(
  '/:id',
  authorize('admin', 'teacher', 'student'),
  validate({ params: schemas.idOrMeParams }),
  controller.get,
);
studentsRoutes.patch(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams, body: schemas.updateStudentBody }),
  controller.update,
);
