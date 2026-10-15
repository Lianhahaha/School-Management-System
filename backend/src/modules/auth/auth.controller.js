import { ok } from '../../utils/respond.js';
import * as service from './auth.service.js';

export async function register(req, res) {
  ok(res, await service.register(req.validated.body), { status: 201 });
}

export async function demo(req, res) {
  ok(res, await service.getDemo());
}

export async function demoSignIn(req, res) {
  ok(res, await service.signInDemo());
}

export async function me(req, res) {
  ok(res, await service.getMe(req.user));
}

export async function updateMe(req, res) {
  ok(res, await service.updateMe(req.user, req.validated.body));
}
