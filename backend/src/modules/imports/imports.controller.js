import { ok } from '../../utils/respond.js';
import * as service from './imports.service.js';

/** 201 only when an account was actually created; a run where every row failed is reported with 200. */
export async function students(req, res) {
  const body = req.validated.body;
  const report = await service.importStudents(body);
  const createdAny = report.results?.some((result) => result.status === 'created');
  ok(res, report, { status: createdAny ? 201 : 200 });
}
