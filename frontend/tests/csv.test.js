import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages, parseCsvRecords, readTextFile, slugify, toCsv } from '../src/lib/csv';

const cellsOf = (text) => parseCsvRecords(text).map((record) => record.cells);

describe('parseCsvRecords', () => {
  it('splits rows and cells and numbers each record by its file line', () => {
    expect(parseCsvRecords('a,b\n1,2\n3,4')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
      { line: 3, cells: ['3', '4'] },
    ]);
  });

  it('ends a row at CRLF, LF or a lone CR, and ignores the newline at the end of the file', () => {
    expect(cellsOf('a,b\r\n1,2\r3,4\n5,6\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ]);
  });

  it('reads quoted cells holding commas, doubled quotes and line breaks', () => {
    const text = 'name,note\n"Cruz, Juan","He said ""hi"""\n"Santos","line one\r\nline two"';
    expect(cellsOf(text)).toEqual([
      ['name', 'note'],
      ['Cruz, Juan', 'He said "hi"'],
      ['Santos', 'line one\r\nline two'],
    ]);
  });

  it('counts the lines of multi-line cells and blank rows, so problems point at the spreadsheet row', () => {
    const text = 'name,note\n"A","two\nlines"\n\n,,\n  ,\nB,x';
    expect(parseCsvRecords(text)).toEqual([
      { line: 1, cells: ['name', 'note'] },
      { line: 2, cells: ['A', 'two\nlines'] },
      { line: 7, cells: ['B', 'x'] },
    ]);
  });

  it('keeps a quote that is not at the start of a cell as a character', () => {
    expect(cellsOf('Juan "JJ" Cruz,5')).toEqual([['Juan "JJ" Cruz', '5']]);
  });

  it('drops a byte-order mark and keeps spaces inside cells', () => {
    expect(cellsOf('﻿Email, First name \nx@y.ph, Ana ')).toEqual([
      ['Email', ' First name '],
      ['x@y.ph', ' Ana '],
    ]);
  });

  it('reads semicolon-separated files when the first line has semicolons and no commas', () => {
    expect(cellsOf('Email;Last name\nana@x.ph;Cruz, Jr.')).toEqual([
      ['Email', 'Last name'],
      ['ana@x.ph', 'Cruz, Jr.'],
    ]);
    // With a comma on the first line, commas separate and semicolons are text.
    expect(cellsOf('a;b,c\n1;2,3')).toEqual([
      ['a;b', 'c'],
      ['1;2', '3'],
    ]);
  });

  it('gives no records for empty or blank text', () => {
    expect(parseCsvRecords('')).toEqual([]);
    expect(parseCsvRecords('﻿\r\n \n,')).toEqual([]);
  });

  it('keeps the rest of the file in a cell whose quote is never closed', () => {
    expect(cellsOf('a,"b\nc,d')).toEqual([['a', 'b\nc,d']]);
  });
});

describe('toCsv', () => {
  const column = (header) => ({ header, value: (row) => row[header] });

  it('writes a header line and one line per row, joined by CRLF', () => {
    expect(
      toCsv(
        [column('name'), column('score')],
        [
          { name: 'Ana', score: 18.5 },
          { name: 'Ben', score: 0 },
        ],
      ),
    ).toBe('name,score\r\nAna,18.5\r\nBen,0');
  });

  it('quotes cells holding a comma, a quote or a line break, and leaves missing values blank', () => {
    const rows = [
      { a: 'Cruz, Juan', b: 'say "hi"', c: 'one\ntwo' },
      { a: null, b: undefined, c: '' },
    ];
    expect(toCsv([column('a'), column('b'), column('c')], rows)).toBe(
      'a,b,c\r\n"Cruz, Juan","say ""hi""","one\ntwo"\r\n,,',
    );
  });

  it('puts an apostrophe before a value a spreadsheet would run as a formula', () => {
    const rows = ['=SUM(A1:A9)', '+cmd', '-2+3', '@user', '\tx', '=HYPERLINK("http://x","y")'].map((v) => ({
      v,
    }));
    expect(
      toCsv([column('v')], rows)
        .split('\r\n')
        .slice(1),
    ).toEqual(["'=SUM(A1:A9)", "'+cmd", "'-2+3", "'@user", "'\tx", '"\'=HYPERLINK(""http://x"",""y"")"']);
  });

  it('leaves numbers and phone numbers as they are, signs included', () => {
    const rows = [-5, '-12.5', '+63 917 555 0101', '(02) 8123-4567'].map((v) => ({ v }));
    expect(
      toCsv([column('v')], rows)
        .split('\r\n')
        .slice(1),
    ).toEqual(['-5', '-12.5', '+63 917 555 0101', '(02) 8123-4567']);
  });

  it('writes the digits of a text column as ="…" so a spreadsheet keeps them, and guards anything else', () => {
    const lrn = { ...column('lrn'), text: true };
    const rows = ['136512140001', '007', '', null, '=1+1', '12 34', 1365].map((value) => ({ lrn: value }));
    expect(toCsv([lrn], rows).split('\r\n')).toEqual([
      'lrn',
      '="136512140001"',
      '="007"',
      '',
      '',
      "'=1+1",
      '12 34',
      '="1365"',
    ]);
  });

  it('reads back exactly what it wrote', () => {
    const rows = [
      { name: 'Peña, María "Mia"', note: 'first line\r\nsecond line', score: 92.25 },
      { name: 'Niño', note: '', score: 0 },
    ];
    const columns = [column('name'), column('note'), column('score')];
    expect(cellsOf(toCsv(columns, rows))).toEqual([
      ['name', 'note', 'score'],
      ['Peña, María "Mia"', 'first line\r\nsecond line', '92.25'],
      ['Niño', '', '0'],
    ]);
  });
});

describe('readTextFile', () => {
  it('reads UTF-8, and falls back to Windows-1252 for a file that is not valid UTF-8', async () => {
    const utf8 = new File([new TextEncoder().encode('Peña,Niño')], 'utf8.csv');
    expect(await readTextFile(utf8)).toBe('Peña,Niño');
    // Excel's plain "CSV (Comma delimited)" on Windows writes ñ as the single byte 0xF1.
    const ansi = new File([new Uint8Array([0x50, 0x65, 0xf1, 0x61])], 'ansi.csv');
    expect(await readTextFile(ansi)).toBe('Peña');
  });
});

describe('slugify', () => {
  it('turns a title into a file name', () => {
    expect(slugify('Algebra Quiz 1 / Grade 10')).toBe('algebra-quiz-1-grade-10');
    expect(slugify('  --Grades: 10-A!  ')).toBe('grades-10-a');
    expect(slugify('***')).toBe('');
  });

  // NFKD splits "ñ" into "n" and a combining tilde; a tilde turned into a dash once made "Niño" "nin-o".
  it('drops accents rather than splitting a word at them', () => {
    expect(slugify('Español Niño')).toBe('espanol-nino');
  });
});

describe('fetchAllPages', () => {
  const pageOf = (items, total, totalPages) => ({ items, meta: { total, totalPages } });

  it('fetches every page at the largest page size, keeping the filters', async () => {
    const fetchPage = vi.fn(async ({ page }) => pageOf([`row ${page}`], 3, 3));
    expect(await fetchAllPages(fetchPage, { classId: 4, page: 9 })).toEqual(['row 1', 'row 2', 'row 3']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { classId: 4, page: 1, limit: 100 });
    expect(fetchPage).toHaveBeenLastCalledWith({ classId: 4, page: 3, limit: 100 });
  });

  it('stops after one page when the list is empty or the response has no page count', async () => {
    const empty = vi.fn(async () => pageOf([], 0, 0));
    expect(await fetchAllPages(empty, {})).toEqual([]);
    const noCount = vi.fn(async () => ({ items: ['a'], meta: { total: 1 } }));
    expect(await fetchAllPages(noCount, {})).toEqual(['a']);
    expect(noCount).toHaveBeenCalledTimes(1);
  });

  it('refuses a list longer than 200 pages instead of returning part of it', async () => {
    const fetchPage = vi.fn(async () => pageOf(['a'], 20001, 201));
    await expect(fetchAllPages(fetchPage, {})).rejects.toThrow('20001 rows are too many for one file');
    expect(fetchPage).toHaveBeenCalledTimes(1);
    const atLimit = vi.fn(async () => pageOf(['a'], 20000, 200));
    expect(await fetchAllPages(atLimit, {})).toHaveLength(200);
  });
});
