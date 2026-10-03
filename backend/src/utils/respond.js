/**
 * Success envelope helpers. Every successful response goes through here so the
 * shape `{ success: true, data, meta? }` is produced in exactly one place.
 */
export function ok(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

/** Paginated list response: `{ data, meta }` as returned by list services. */
export function okPage(res, { data, meta }) {
  ok(res, data, { meta });
}
