/**
 * Gives every request an id, echoed in the X-Request-Id response header and
 * attached to log lines, so a failed call in the UI can be matched to the log.
 */
import { randomUUID } from 'node:crypto';

const INCOMING_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get('X-Request-Id');
  req.id = incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
