import { ok, okPage } from '../../utils/respond.js';
import * as service from './schedules.service.js';

export async function list(req, res) {
  okPage(res, await service.listSchedules(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getSchedule(req.user, req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createSchedule(req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateSchedule(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteSchedule(req.validated.params.id));
}
