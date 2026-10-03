/**
 * Drops '', null and undefined so that only meaningful parameters reach the API (the backend
 * rejects unknown or empty query parameters) and so that query keys stay free of noise.
 * Also used for query-string building in apiClient.
 * @param {Record<string, *>} [params]
 * @returns {Record<string, *>}
 */
export function toApiParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}
