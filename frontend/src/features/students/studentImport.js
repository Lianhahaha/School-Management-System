/**
 * The student import file: which columns it has, how their headers are recognised, the template, and the
 * conversion from parsed CSV rows to the rows POST /imports/students takes. Header matching ignores case,
 * spaces and punctuation, so "First name", "first_name" and "FirstName" all work.
 */
import { BULK_MAX_ROWS } from '../../constants/shared';
import { parseCsvRecords } from '../../lib/csv';

/** API field -> header in the template, and the other spellings accepted. */
export const IMPORT_COLUMNS = [
  { field: 'email', header: 'Email', aliases: ['emailaddress'], required: true },
  { field: 'firstName', header: 'First name', aliases: ['givenname', 'first'], required: true },
  { field: 'lastName', header: 'Last name', aliases: ['surname', 'familyname', 'last'], required: true },
  { field: 'phone', header: 'Phone', aliases: ['phonenumber', 'mobile', 'contactnumber'] },
  { field: 'studentNumber', header: 'Student number', aliases: ['studentno'] },
  { field: 'admissionDate', header: 'Admission date', aliases: [] },
  { field: 'dateOfBirth', header: 'Date of birth', aliases: ['birthdate', 'birthday', 'dob'] },
  { field: 'gender', header: 'Gender', aliases: ['sex'] },
  { field: 'address', header: 'Address', aliases: [] },
  { field: 'guardianName', header: 'Guardian name', aliases: ['guardian', 'parentname', 'parent'] },
  { field: 'guardianPhone', header: 'Guardian phone', aliases: ['parentphone', 'guardiancontact'] },
  { field: 'className', header: 'Class', aliases: ['classname', 'section'] },
];

/** Header label of an API field, for problem lists ("email" -> "Email"). */
export const columnLabel = (field) =>
  IMPORT_COLUMNS.find((column) => column.field === field)?.header ?? field;

const normalize = (header) => header.toLowerCase().replace(/[^a-z]/g, '');

const FIELD_BY_HEADER = new Map(
  IMPORT_COLUMNS.flatMap((column) => [
    [normalize(column.header), column.field],
    ...column.aliases.map(/** @returns {[string, string]} */ (alias) => [alias, column.field]),
  ]),
);

/** The template's header line and one example row. */
export const TEMPLATE_COLUMNS = IMPORT_COLUMNS.map((column) => ({
  header: column.header,
  value: (row) => row[column.field],
}));
export const TEMPLATE_ROWS = [
  {
    email: 'maria.santos@example.com',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '+63 917 555 0101',
    dateOfBirth: '2011-04-15',
    gender: 'female',
    guardianName: 'Ana Santos',
    guardianPhone: '+63 917 555 0102',
    className: 'Grade 10 - A',
  },
];

/** A cell as typed: trimmed, without the apostrophe our own exports put before a formula-like value. */
const cellValue = (text = '') => text.trim().replace(/^'(?=[=+\-@])/, '');

/** @typedef {{ line: number } & Record<string, string>} ImportRow the file line, and a cell per API field */

/**
 * Reads the text of a CSV file. `line` is the row number the spreadsheet shows (the header is row 1, blank
 * rows still count), sent to the API so its problems point at the file. When two columns map to one field
 * ("Phone" and "Mobile"), the first non-blank value wins.
 * @param {string} text
 * @returns {{ rows: ImportRow[], missing: string[], ignored: string[], error: string | null }}
 */
export function readImportFile(text) {
  const [headerRecord, ...records] = parseCsvRecords(text);
  const headers = headerRecord?.cells ?? [];
  const fields = headers.map((header) => FIELD_BY_HEADER.get(normalize(header)) ?? null);
  const missing = IMPORT_COLUMNS.filter((column) => column.required && !fields.includes(column.field)).map(
    (column) => column.header,
  );
  const ignored = headers.filter((header, index) => !fields[index] && header.trim() !== '');
  const rows = records.map(({ line, cells }) => {
    // Every key but `line` is set below to a cell, a string.
    const row = /** @type {ImportRow} */ ({ line });
    fields.forEach((field, column) => {
      if (field && !row[field]) row[field] = cellValue(cells[column]);
    });
    return row;
  });

  let error = null;
  if (headers.length === 0) error = 'The file is empty.';
  else if (missing.length) error = `The file has no ${missing.join(', ')} column. Start from the template.`;
  else if (rows.length === 0) error = 'The file has a header row but no students.';
  else if (rows.length > BULK_MAX_ROWS) {
    error = `The file has ${rows.length} students; import at most ${BULK_MAX_ROWS} at a time.`;
  }
  return { rows, missing, ignored, error };
}
