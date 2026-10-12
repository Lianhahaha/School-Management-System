/**
 * Reading a whole paginated list from the API, for screens that need every row at once (a student's grades of
 * a school year, the roster of a class), not one page of a table.
 */
import { PAGINATION } from '../constants/shared';

/** At most this many pages (100 rows each, 20 000 rows) are fetched for one list. */
const MAX_PAGES = 200;

/**
 * Every row of a paginated list endpoint, page by page. It never returns part of a list: a list longer than
 * the limit is refused with a message, instead of a list that silently stops.
 *
 * The pages are separate requests, not one snapshot: a row saved between two of them (a grade entered, a
 * mark taken) pushes the rows after it one place down, and the last row of a page comes back as the first of
 * the next. So a row is kept once, by `id`, as first read; rows without an id are all kept. (A row deleted
 * meanwhile pulls the rows up instead and one can be missed; only a server-side snapshot would prevent that.)
 * @param {(params: object) => Promise<{ items: object[], meta: { total: number, totalPages: number } }>} fetchPage
 *   e.g. listGrades
 * @param {object} params list filters; `page` and `limit` are set here
 * @returns {Promise<object[]>}
 */
export async function fetchAllPages(fetchPage, params) {
  const rows = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    const { items, meta } = await fetchPage({ ...params, page, limit: PAGINATION.MAX_LIMIT });
    if (meta.totalPages > MAX_PAGES) {
      throw new Error(`${meta.total} rows are too many to load at once. Narrow the filters and try again.`);
    }
    for (const item of items) {
      const id = /** @type {{ id?: unknown }} */ (item)?.id;
      if (id !== undefined && id !== null) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      rows.push(item);
    }
    if (!(page < meta.totalPages)) return rows; // also stops if a response ever lacks totalPages
  }
}
