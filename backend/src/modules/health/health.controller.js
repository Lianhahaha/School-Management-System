/**
 * GET /health — liveness plus a 2-second database ping. Public. Also reports the
 * Firebase project id (not a secret) so the frontend can warn in development
 * when its web config points at a different project.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ping } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ok } from '../../utils/respond.js';

const { version } = JSON.parse(readFileSync(path.join(env.backendRoot, 'package.json'), 'utf8'));

function firebaseProjectId() {
  try {
    return JSON.parse(readFileSync(env.firebaseServiceAccountPath, 'utf8')).project_id ?? null;
  } catch {
    return null;
  }
}

export async function check(_req, res, next) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('db ping timeout')), 2000);
  });
  try {
    await Promise.race([ping(), timeout]);
  } catch {
    return next(ApiError.unavailable('db'));
  } finally {
    clearTimeout(timer);
  }
  ok(res, {
    status: 'ok',
    db: 'up',
    version,
    firebaseProjectId: firebaseProjectId(),
    timeZone: env.APP_TIMEZONE,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
