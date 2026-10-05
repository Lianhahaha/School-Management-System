/**
 * check-constants.js — guards the cross-layer contract.
 *
 * 1. backend/src/constants/shared.js and frontend/src/constants/shared.js must be
 *    byte-identical (line endings normalised).
 * 2. Every ENUM column in backend/database/schema.sql must list exactly the values
 *    of its constant, in the same order, and every ENUM column must be mapped here
 *    (so a new ENUM cannot be added without a constant).
 *
 * Exit code 1 with a readable diff on any mismatch. Run by `npm test`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const backendRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

const backendConstantsPath = path.join(backendRoot, 'src', 'constants', 'shared.js');
const frontendConstantsPath = path.join(repoRoot, 'frontend', 'src', 'constants', 'shared.js');
const schemaPath = path.join(backendRoot, 'database', 'schema.sql');

const normalise = (text) => text.replace(/\r\n/g, '\n');

let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`✖ ${message}`);
};

// 1. Byte equality of the two copies.
const backendSource = normalise(readFileSync(backendConstantsPath, 'utf8'));
let frontendSource;
try {
  frontendSource = normalise(readFileSync(frontendConstantsPath, 'utf8'));
} catch {
  fail(`frontend copy missing: ${frontendConstantsPath}`);
}
if (frontendSource !== undefined) {
  if (backendSource === frontendSource) {
    console.log('✔ constants/shared.js is identical on both sides');
  } else {
    const a = backendSource.split('\n');
    const b = frontendSource.split('\n');
    const firstDiff = a.findIndex((line, i) => line !== b[i]);
    fail(
      `constants/shared.js differs between backend and frontend (first difference at line ${firstDiff + 1}):\n` +
        `  backend : ${a[firstDiff] ?? '<end of file>'}\n` +
        `  frontend: ${b[firstDiff] ?? '<end of file>'}`,
    );
  }
}

// 2. ENUM columns in schema.sql vs constants.
const constants = await import(pathToFileURL(backendConstantsPath).href);
const ENUM_COLUMNS = {
  'users.role': constants.ROLES,
  'students.gender': constants.GENDERS,
  'enrollments.status': constants.ENROLLMENT_STATUSES,
  'attendance.status': constants.ATTENDANCE_STATUSES,
  'assessments.type': constants.ASSESSMENT_TYPES,
  'assessments.term': constants.TERMS,
  'subject_grade_weights.assessment_type': constants.ASSESSMENT_TYPES,
  'calendar_events.type': constants.CALENDAR_EVENT_TYPES,
  'activity_log.actor_role': constants.ROLES,
  'announcements.audience': constants.ANNOUNCEMENT_AUDIENCES,
};

let schema;
try {
  schema = normalise(readFileSync(schemaPath, 'utf8'));
} catch {
  fail(`schema missing: ${schemaPath}`);
}

if (schema) {
  const tableBlocks = schema.split(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/).slice(1);
  const found = new Map();
  for (let i = 0; i < tableBlocks.length; i += 2) {
    const table = tableBlocks[i];
    const body = tableBlocks[i + 1];
    for (const match of body.matchAll(/^\s*`?(\w+)`?\s+ENUM\s*\(([^)]*)\)/gim)) {
      const column = match[1];
      const values = match[2].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
      found.set(`${table}.${column}`, values);
    }
  }

  for (const [key, expected] of Object.entries(ENUM_COLUMNS)) {
    const actual = found.get(key);
    if (!actual) {
      fail(`schema.sql has no ENUM column ${key}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify([...expected])) {
      fail(`ENUM ${key} differs:\n  schema.sql: ${actual.join(', ')}\n  shared.js : ${expected.join(', ')}`);
    }
  }
  for (const key of found.keys()) {
    if (!(key in ENUM_COLUMNS))
      fail(`ENUM column ${key} exists in schema.sql but is not mapped to a constant`);
  }
  if (!failed) console.log(`✔ ${Object.keys(ENUM_COLUMNS).length} ENUM columns match constants/shared.js`);
}

process.exit(failed ? 1 : 0);
