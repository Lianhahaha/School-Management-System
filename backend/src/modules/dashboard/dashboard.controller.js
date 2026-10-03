import { ok } from '../../utils/respond.js';
import * as service from './dashboard.service.js';

export async function get(req, res) {
  ok(res, await service.getDashboard(req.user));
}
