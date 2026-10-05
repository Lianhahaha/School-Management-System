import { ok } from '../../utils/respond.js';
import * as service from './imports.service.js';

export async function students(req, res) {
  const body = req.validated.body;
  ok(res, await service.importStudents(body), { status: body.dryRun ? 200 : 201 });
}
