import { ok, okPage } from '../../utils/respond.js';
import * as service from './assistantRequests.service.js';

export async function list(req, res) {
  okPage(res, await service.listRequests(req.user, req.validated.query));
}

export async function approve(req, res) {
  ok(res, await service.approve(req.user, req.validated.params.userId));
}

export async function decline(req, res) {
  ok(res, await service.decline(req.user, req.validated.params.userId, req.validated.body));
}
