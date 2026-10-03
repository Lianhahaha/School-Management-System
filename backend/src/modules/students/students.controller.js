import { ok, okPage } from '../../utils/respond.js';
import * as service from './students.service.js';

export async function list(req, res) {
  okPage(res, await service.listStudents(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getStudent(req.user, req.validated.params.id));
}

export async function update(req, res) {
  ok(res, await service.updateStudent(req.validated.params.id, req.validated.body));
}
