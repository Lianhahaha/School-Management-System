import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './imports.controller.js';
import * as schemas from './imports.schemas.js';

export const importsRoutes = Router();

importsRoutes.post(
  '/students',
  authorize('admin'),
  validate({ body: schemas.importStudentsBody }),
  controller.students,
);
