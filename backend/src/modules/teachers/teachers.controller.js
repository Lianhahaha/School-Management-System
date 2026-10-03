import { ok, okPage } from '../../utils/respond.js';
import * as service from './teachers.service.js';

export async function list(req, res) {
  okPage(res, await service.listTeachers(req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getTeacher(req.user, req.validated.params.id));
}

export async function update(req, res) {
  ok(res, await service.updateTeacher(req.validated.params.id, req.validated.body));
}
