import { ok, okPage } from '../../utils/respond.js';
import * as service from './classes.service.js';

export async function list(req, res) {
  okPage(res, await service.listClasses(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getClass(req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createClass(req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateClass(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteClass(req.validated.params.id));
}
