import { ok, okPage } from '../../utils/respond.js';
import * as service from './classSubjects.service.js';

export async function list(req, res) {
  okPage(res, await service.listClassSubjects(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getClassSubject(req.user, req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createClassSubject(req.validated.body), { status: 201 });
}

export async function reassign(req, res) {
  ok(res, await service.reassignTeacher(req.validated.params.id, req.validated.body.teacherId));
}

export async function remove(req, res) {
  ok(res, await service.deleteClassSubject(req.validated.params.id));
}
