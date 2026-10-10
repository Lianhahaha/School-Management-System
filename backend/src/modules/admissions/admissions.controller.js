import { ok } from '../../utils/respond.js';
import * as service from './admissions.service.js';

export async function updateChecklist(req, res) {
  ok(res, await service.updateChecklist(req.user, req.validated.params.studentId, req.validated.body));
}

export async function decline(req, res) {
  ok(res, await service.decline(req.user, req.validated.params.studentId, req.validated.body));
}
