import { ok, okPage } from '../../utils/respond.js';
import * as service from './assessments.service.js';

export async function list(req, res) {
  okPage(res, await service.listAssessments(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getAssessment(req.user, req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createAssessment(req.user, req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateAssessment(req.user, req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteAssessment(req.user, req.validated.params.id));
}
