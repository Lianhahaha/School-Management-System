/**
 * Unwrap the `{ data, meta }` response of apiClient, so that feature api.js files return plain
 * values and hooks and components never see the envelope:
 *
 *   export const getStudent = (id) => api.get(`/students/${id}`).then(toData);
 *   export const listStudents = (params) => api.get('/students', { params }).then(toPage);
 */

/** Single resource, array, or aggregate: just the payload. */
export const toData = (response) => response.data;

/** Paginated list: `{ items, meta: { page, limit, total, totalPages } }`. */
export const toPage = (response) => ({ items: response.data, meta: response.meta });
