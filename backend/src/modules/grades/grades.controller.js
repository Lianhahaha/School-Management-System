import { ok, okPage } from '../../utils/respond.js';
import * as service from './grades.service.js';

export async function list(req, res) {
  okPage(res, await service.listGrades(req.user, req.validated.query));
}

export async function summary(req, res) {
  ok(res, await service.getSummary(req.user, req.validated.query));
}

export async function remove(req, res) {
  ok(res, await service.deleteGrade(req.user, req.validated.params.id));
}

export async function getRoster(req, res) {
  ok(res, await service.getRoster(req.user, req.validated.params.id));
}

export async function saveGrades(req, res) {
  ok(res, await service.saveGrades(req.user, req.validated.params.id, req.validated.body));
}
