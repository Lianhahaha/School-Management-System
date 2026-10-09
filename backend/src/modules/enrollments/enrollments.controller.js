import { ok, okPage } from '../../utils/respond.js';
import * as service from './enrollments.service.js';

export async function list(req, res) {
  okPage(res, await service.listEnrollments(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getEnrollment(req.user, req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.enroll(req.validated.body), { status: 201 });
}

export async function createMany(req, res) {
  ok(res, await service.enrollMany(req.validated.body), { status: 201 });
}

export async function transfer(req, res) {
  ok(res, await service.transfer(req.validated.body), { status: 201 });
}

export async function completeYear(req, res) {
  ok(res, await service.completeYear(req.validated.body));
}

export async function myNextClass(req, res) {
  ok(res, await service.myNextClass(req.user));
}

export async function enrollMyself(req, res) {
  ok(res, await service.enrollMyself(req.user, req.validated.body), { status: 201 });
}

export async function setStatus(req, res) {
  ok(res, await service.setStatus(req.validated.params.id, req.validated.body.status));
}
