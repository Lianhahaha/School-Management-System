import { ok, okPage } from '../../utils/respond.js';
import * as service from './users.service.js';

export async function list(req, res) {
  okPage(res, await service.listUsers(req.validated.query));
}

export async function create(req, res) {
  ok(res, await service.createUserAccount(req.validated.body, { trusted: true }), { status: 201 });
}

export async function get(req, res) {
  ok(res, await service.getAccount(req.validated.params.id));
}

export async function update(req, res) {
  ok(res, await service.updateUser(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteUser(req.user, req.validated.params.id));
}

export async function setStatus(req, res) {
  ok(res, await service.setStatus(req.user, req.validated.params.id, req.validated.body.isActive));
}
