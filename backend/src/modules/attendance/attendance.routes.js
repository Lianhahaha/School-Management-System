import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './attendance.controller.js';
import * as schemas from './attendance.schemas.js';

export const attendanceRoutes = Router();

attendanceRoutes.get('/', validate({ query: schemas.listAttendanceQuery }), controller.list);
// Fixed sub-paths are declared before '/:id'.
attendanceRoutes.get('/summary', validate({ query: schemas.summaryQuery }), controller.summary);
attendanceRoutes.get(
  '/sheet',
  authorize('admin', 'teacher'),
  validate({ query: schemas.sheetQuery }),
  controller.getSheet,
);
attendanceRoutes.put(
  '/sheet',
  authorize('admin', 'teacher'),
  validate({ body: schemas.saveSheetBody }),
  controller.saveSheet,
);
attendanceRoutes.patch(
  '/:id',
  authorize('admin', 'teacher'),
  validate({ params: schemas.idParams, body: schemas.updateAttendanceBody }),
  controller.update,
);
attendanceRoutes.delete(
  '/:id',
  authorize('admin'),
  validate({ params: schemas.idParams }),
  controller.remove,
);
