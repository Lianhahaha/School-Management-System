import { ok, okPage } from '../../utils/respond.js';
import * as service from './fees.service.js';

export async function list(req, res) {
  okPage(res, await service.listFees(req.validated.query));
}

export async function create(req, res) {
  ok(res, await service.createFee(req.validated.body), { status: 201 });
}

export async function update(req, res) {
  ok(res, await service.updateFee(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  ok(res, await service.deleteFee(req.validated.params.id));
}

export async function statement(req, res) {
  ok(res, await service.getStatement(req.user, req.validated.query));
}

export async function recordPayment(req, res) {
  ok(res, await service.recordPayment(req.user, req.validated.body), { status: 201 });
}

export async function removePayment(req, res) {
  ok(res, await service.deletePayment(req.validated.params.id));
}
