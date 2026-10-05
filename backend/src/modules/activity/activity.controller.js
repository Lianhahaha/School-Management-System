import { okPage } from '../../utils/respond.js';
import * as service from './activity.service.js';

export async function list(req, res) {
  okPage(res, await service.listActivity(req.validated.query));
}
