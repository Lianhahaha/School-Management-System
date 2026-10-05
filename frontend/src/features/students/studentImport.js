/**
 * The student import file: which columns it has, how their headers are recognised, the template, and the
 * conversion from parsed CSV rows to the rows POST /imports/students takes. Header matching ignores case,
 * spaces and punctuation, so "First name", "first_name" and "FirstName" all work.
 */
import { BULK_MAX_ROWS } from '../../constants/shared';
import { parseCsv } from '../../lib/csv';

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
    ...column.aliases.map((alias) => [alias, column.field]),
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

/**
 * Reads the text of a CSV file. `row` is the spreadsheet row number (the header is row 1), sent to the API
 * as `line` so its problems point at the file.
 * @returns {{ rows: Array<{ line: number } & Record<string, string>>, missing: string[], ignored: string[],
 *   error: string | null }}
 */
export function readImportFile(text) {
  const [headers = [], ...records] = parseCsv(text);
  const fields = headers.map((header) => FIELD_BY_HEADER.get(normalize(header)) ?? null);
  const missing = IMPORT_COLUMNS.filter((column) => column.required && !fields.includes(column.field)).map(
    (column) => column.header,
  );
  const ignored = headers.filter((header, index) => !fields[index] && header.trim() !== '');
  const rows = records.map((cells, index) => {
    const row = { line: index + 2 };
    fields.forEach((field, column) => {
      if (field && row[field] === undefined) row[field] = (cells[column] ?? '').trim();
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
