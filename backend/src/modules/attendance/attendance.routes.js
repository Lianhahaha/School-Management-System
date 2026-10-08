import { Router } from 'express';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './attendance.controller.js';
import * as schemas from './attendance.schemas.js';

export const attendanceRoutes = Router();

// Marks are written and corrected through the sheet only, which checks what the teacher saw (previous).
attendanceRoutes.get('/', validate({ query: schemas.listAttendanceQuery }), controller.list);
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
