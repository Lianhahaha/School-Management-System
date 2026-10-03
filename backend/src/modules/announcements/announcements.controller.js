import { ok, okPage } from '../../utils/respond.js';
import * as service from './announcements.service.js';

export async function list(req, res) {
  okPage(res, await service.listAnnouncements(req.user, req.validated.query));
}

export async function get(req, res) {
  ok(res, await service.getAnnouncement(req.user, req.validated.params.id));
}

export async function create(req, res) {
  ok(res, await service.createAnnouncement(req.user, req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateAnnouncement(req.user, req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteAnnouncement(req.user, req.validated.params.id));
}
