import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/lib/csv';
import {
  columnLabel,
  IMPORT_COLUMNS,
  readImportFile,
  TEMPLATE_COLUMNS,
  TEMPLATE_ROWS,
} from '../src/features/students/studentImport';

const HEADER = 'Email,First name,Last name';

describe('readImportFile', () => {
  it('reads the template it hands out, phone numbers included', () => {
    const { rows, missing, ignored, error } = readImportFile(toCsv(TEMPLATE_COLUMNS, TEMPLATE_ROWS));
    expect({ missing, ignored, error }).toEqual({ missing: [], ignored: [], error: null });
    // Fields the template row leaves out come back as blank strings, which the API treats as not given.
    const blanks = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.field, '']));
    expect(rows).toEqual([{ line: 2, ...blanks, ...TEMPLATE_ROWS[0] }]);
  });

  it('recognises headers whatever their case, spacing, punctuation or common alternative name', () => {
    const text =
      'E-mail Address,first_name,LastName,Mobile,DOB,Sex,Section,Student No.\n' +
      'ana@x.ph,Ana,Cruz,0917 555 0101,2011-04-15,female,Grade 10 - A,STU-2026-0001';
    const { rows, error } = readImportFile(text);
    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({
      email: 'ana@x.ph',
      firstName: 'Ana',
      lastName: 'Cruz',
      phone: '0917 555 0101',
      dateOfBirth: '2011-04-15',
      gender: 'female',
      className: 'Grade 10 - A',
      studentNumber: 'STU-2026-0001',
    });
  });

  it('takes the first non-blank value when two columns mean the same field', () => {
    const text = `${HEADER},Phone,Mobile\na@x.ph,A,Cruz,,0917 111 1111\nb@x.ph,B,Reyes,0917 222 2222,0917 333 3333`;
    const { rows } = readImportFile(text);
    expect(rows.map((row) => row.phone)).toEqual(['0917 111 1111', '0917 222 2222']);
  });

  it('lists columns it does not know, but not blank headers', () => {
    const { ignored, error } = readImportFile(
      `${HEADER},Nickname,,Favourite subject\na@x.ph,A,Cruz,Ann,,Math`,
    );
    expect(error).toBeNull();
    expect(ignored).toEqual(['Nickname', 'Favourite subject']);
  });

  it('trims cells and drops the apostrophe an export puts before a formula-like value', () => {
    // An apostrophe that is not before = + - @ is part of the value ('Neil, O'Neil) and stays.
    const text = `${HEADER},Phone,Address\n  a@x.ph , 'Neil ,O'Neil, '+63 917 555 0101 , '=Main St\n`;
    expect(readImportFile(text).rows[0]).toMatchObject({
      email: 'a@x.ph',
      firstName: "'Neil",
      lastName: "O'Neil",
      phone: '+63 917 555 0101',
      address: '=Main St',
    });
  });

  it('gives a short row blank values for the cells it lacks', () => {
    const { rows } = readImportFile(`${HEADER},Phone\na@x.ph,Ana`);
    expect(rows[0]).toMatchObject({ email: 'a@x.ph', firstName: 'Ana', lastName: '', phone: '' });
  });

  it('numbers rows by the spreadsheet row, counting blank rows and multi-line cells', () => {
    const text = `${HEADER},Address\na@x.ph,A,Cruz,"Blk 1\nLot 2"\n\nb@x.ph,B,Reyes,`;
    expect(readImportFile(text).rows.map((row) => row.line)).toEqual([2, 5]);
  });

  it('reads a semicolon-separated export', () => {
    const { rows, error } = readImportFile('Email;First name;Last name\na@x.ph;Ana;Cruz, Jr.');
    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({ lastName: 'Cruz, Jr.' });
  });
});

describe('readImportFile refusals', () => {
  it('refuses an empty file', () => {
    expect(readImportFile('').error).toBe('The file is empty.');
    expect(readImportFile('﻿\n\n').error).toBe('The file is empty.');
  });

  it('names every required column that is missing', () => {
    const { missing, error } = readImportFile('First name,Phone\nAna,0917 555 0101');
    expect(missing).toEqual(['Email', 'Last name']);
    expect(error).toBe('The file has no Email, Last name column. Start from the template.');
  });

  it('refuses a header row without students', () => {
    expect(readImportFile(`${HEADER}\n\n,,\n`).error).toBe('The file has a header row but no students.');
  });

  it('accepts 200 students and refuses 201', () => {
    const fileOf = (count) =>
      [HEADER, ...Array.from({ length: count }, (_, i) => `s${i}@x.ph,S${i},Cruz`)].join('\n');
    expect(readImportFile(fileOf(200)).error).toBeNull();
    expect(readImportFile(fileOf(201)).error).toBe(
      'The file has 201 students; import at most 200 at a time.',
    );
  });
});

describe('columnLabel', () => {
  it('names a field by its template header, and leaves an unknown field as it is', () => {
    expect(columnLabel('dateOfBirth')).toBe('Date of birth');
    expect(columnLabel('nickname')).toBe('nickname');
  });
});
