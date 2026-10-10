/**
 * CSV in the browser: read and parse an uploaded file (readTextFile, parseCsvRecords), and build text from
 * rows and hand it to the user as a download (export).
 * Spreadsheets (Excel, Google Sheets, Numbers) open the file directly; a byte-order mark makes Excel
 * read it as UTF-8, so names with accents survive.
 *
 *   downloadCsv('grades-algebra-quiz-1', [
 *     { header: 'Student no', value: (record) => record.studentNumber },
 *     { header: 'Score', value: (record) => record.score },
 *   ], records);
 *
 * A column with `text: true` holds an identifier made of digits (an LRN) that a spreadsheet must not turn
 * into a number: see textCell.
 */
import { PAGINATION } from '../constants/shared';

/** @typedef {{ header: string, value: (row: object) => unknown, text?: boolean }} CsvColumn */

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
 * A cell of a `text` column. Excel shows a 12-digit LRN as 1.23457E+11 and drops leading zeros, so a value
 * of digits only is written as the formula ="136512140001", which Excel and Google Sheets show as that text.
 * The formula is safe because it holds nothing but digits; any other value goes through `cell` and its
 * formula guard.
 */
function textCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^\d+$/.test(text) ? `="${text}"` : cell(value);
}

/**
 * @param {CsvColumn[]} columns
 * @param {object[]} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => (column.text ? textCell : cell)(column.value(row))).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Parses CSV text (RFC 4180: quoted cells may hold commas, line breaks and doubled quotes) into records.
 * Each record keeps the file line it starts on (1 = first line), so problems can point at the spreadsheet
 * row even when blank rows or multi-line cells come before it. A byte-order mark is dropped, CRLF and LF
 * both end a row, and rows whose cells are all blank are left out. A quote opens a quoted cell only at
 * the start of a cell; elsewhere it is kept as a character (Juan "JJ" Cruz). Semicolon-separated files (a
 * common European Excel export) are read too, when the first line has semicolons and no commas.
 * @param {string} text
 * @returns {Array<{ line: number, cells: string[] }>}
 */
export function parseCsvRecords(text) {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const records = [];
  let line = 1;
  let recordLine = 1;
  let cells = [];
  let value = '';
  let inQuotes = false;
  let cellStart = true;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === '\n' || (char === '\r' && source[i + 1] !== '\n')) line += 1;
        value += char;
      }
    } else if (char === '"' && cellStart) {
      inQuotes = true;
      cellStart = false;
    } else if (char === separator) {
      cells.push(value);
      value = '';
      cellStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      cells.push(value);
      records.push({ line: recordLine, cells });
      line += 1;
      recordLine = line;
      cells = [];
      value = '';
      cellStart = true;
    } else {
      value += char;
      cellStart = false;
    }
  }
  cells.push(value);
  records.push({ line: recordLine, cells });
  return records.filter((record) => record.cells.some((text) => text.trim() !== ''));
}

/**
 * Reads the bytes of an uploaded text file. UTF-8 first; a file that is not valid UTF-8 is read as
 * Windows-1252, the encoding Excel's plain "CSV (Comma delimited)" uses on Windows, so names such as
 * Pe\u00F1a or Ni\u00F1o survive either way.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function readTextFile(file) {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
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
