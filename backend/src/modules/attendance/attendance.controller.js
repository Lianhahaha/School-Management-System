import { ok, okPage } from '../../utils/respond.js';
import * as service from './attendance.service.js';

export async function list(req, res) {
  okPage(res, await service.listAttendance(req.user, req.validated.query));
}

export async function summary(req, res) {
  ok(res, await service.getSummary(req.user, req.validated.query));
}

export async function getSheet(req, res) {
  ok(res, await service.getSheet(req.user, req.validated.query));
}

export async function saveSheet(req, res) {
  ok(res, await service.saveSheet(req.user, req.validated.body));
}
