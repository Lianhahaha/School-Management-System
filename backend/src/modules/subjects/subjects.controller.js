import { ok, okPage } from '../../utils/respond.js';
import * as service from './subjects.service.js';

export async function list(req, res) {
  okPage(res, await service.listSubjects(req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getSubject(req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createSubject(req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateSubject(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteSubject(req.validated.params.id));
}
