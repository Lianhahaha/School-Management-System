import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as controller from './dashboard.controller.js';

export const dashboardRoutes = Router();

/** The payload is built from the caller alone; any query parameter is a client bug. */
dashboardRoutes.get('/', validate({ query: z.strictObject({}) }), controller.get);
