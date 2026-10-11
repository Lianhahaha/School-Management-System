import { ok } from '../../utils/respond.js';
import * as service from './admissions.service.js';

export async function updateChecklist(req, res) {
  ok(res, await service.updateChecklist(req.user, req.validated.params.studentId, req.validated.body));
}
