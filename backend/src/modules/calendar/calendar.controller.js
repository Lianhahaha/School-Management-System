import { ok, okPage } from '../../utils/respond.js';
import * as service from './calendar.service.js';

export async function list(req, res) {
  okPage(res, await service.listEvents(req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getEvent(req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createEvent(req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateEvent(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteEvent(req.validated.params.id));
}
