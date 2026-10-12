/**
 * CSV in the browser: build text from rows and hand it to the user as a download (export).
 * Spreadsheets (Excel, Google Sheets, Numbers) open the file directly; a byte-order mark makes Excel
 * read it as UTF-8, so names with accents survive.
 *
 *   downloadCsv('grades-algebra-quiz-1', [
 *     { header: 'Student no', value: (record) => record.studentNumber },
 *     { header: 'Score', value: (record) => record.score },
 *   ], records);
 */
import { PAGINATION } from '../constants/shared';

/** @typedef {{ header: string, value: (row: object) => unknown }} CsvColumn */

/** A phone number or a plain number: safe to leave as it is although it may start with + or -. */
const NUMBER_LIKE = /^[+-]?[\d\s().-]+$/;

/**
 * Quotes a cell when it holds a comma, quote or line break. A value a spreadsheet would run as a formula
 * (starting with `=` `+` `-` `@`, tab or carriage return) gets a leading apostrophe, unless it is just a
 * number or a phone number such as "+63 917 555 0101".
 */
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !NUMBER_LIKE.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {CsvColumn[]} columns
 * @param {object[]} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => cell(column.value(row))).join(','));
  }
  return lines.join('\r\n');
}

/** "Algebra Quiz 1 / Grade 10" -> "algebra-quiz-1-grade-10", for file names. Accents drop: "Niño" -> "nino". */
export function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      // NFKD splits "ñ" into "n" and a combining tilde; the mark goes, so it does not become a dash.
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/**
 * Downloads `rows` as `<name>.csv`.
 * @param {string} name file name without extension
 * @param {CsvColumn[]} columns
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
    if (meta.totalPages > MAX_EXPORT_PAGES) {
      throw new Error(
        `${meta.total} rows are too many for one file. Narrow the dates or filters and download again.`,
      );
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
