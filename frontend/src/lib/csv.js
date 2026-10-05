/**
 * CSV export in the browser: build the text from rows and hand it to the user as a download.
 * Spreadsheets (Excel, Google Sheets, Numbers) open the file directly; a byte-order mark makes Excel
 * read it as UTF-8, so names with accents survive.
 *
 *   downloadCsv('grades-algebra-quiz-1', [
 *     { header: 'Student no', value: (record) => record.studentNumber },
 *     { header: 'Score', value: (record) => record.score },
 *   ], records);
 */
import { PAGINATION } from '../constants/shared';

/** Quotes a cell when it holds a comma, quote or line break; a value starting with = + - @ is neutralised. */
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`; // a spreadsheet would run it as a formula
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {Array<{ header: string, value: (row: object) => unknown }>} columns
 * @param {object[]} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','));
  return lines.join('\r\n');
}

/** "Algebra Quiz 1 / Grade 10" -> "algebra-quiz-1-grade-10", for file names. */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Downloads `rows` as `<name>.csv`.
 * @param {string} name file name without extension
 * @param {Array<{ header: string, value: (row: object) => unknown }>} columns
 * @param {object[]} rows
 */
export function downloadCsv(name, columns, rows) {
  const blob = new Blob(['﻿', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(name) || 'export'}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** At most this many pages (100 rows each, 20 000 rows) are fetched for one export. */
const MAX_EXPORT_PAGES = 200;

/**
 * Every row of a paginated list endpoint, page by page, for exports. It never returns part of a list:
 * a list longer than the export limit is refused with a message, instead of a file that silently stops.
 * @param {(params: object) => Promise<{ items: object[], meta: { total: number, totalPages: number } }>} fetchPage
 *   e.g. listGrades
 * @param {object} params list filters; `page` and `limit` are set here
 * @returns {Promise<object[]>}
 */
export async function fetchAllPages(fetchPage, params) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const { items, meta } = await fetchPage({ ...params, page, limit: PAGINATION.MAX_LIMIT });
    if (meta.totalPages > MAX_EXPORT_PAGES) {
      throw new Error(
        `${meta.total} rows are too many for one file. Narrow the dates or filters and download again.`,
      );
    }
    rows.push(...items);
    if (!(page < meta.totalPages)) return rows; // also stops if a response ever lacks totalPages
  }
}
