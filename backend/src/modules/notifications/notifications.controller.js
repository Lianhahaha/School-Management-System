import { ok, okPage } from '../../utils/respond.js';
import * as service from './notifications.service.js';

export async function list(req, res) {
  okPage(res, await service.listMine(req.user, req.validated.query));
}

export async function unreadCount(req, res) {
  ok(res, await service.unreadCount(req.user));
}

export async function markRead(req, res) {
  ok(res, await service.markRead(req.user, req.validated.body.ids));
}
