/**
 * seed.js — demo data: 13 accounts (Firebase + MySQL) and database/seed.sql for everything else.
 *
 *   npm run db:seed     safe to run again: accounts are re-linked, seed.sql runs only while `subjects` is empty
 *   npm run db:reset    drop the database, migrate, seed
 *
 * Needs the schema (npm run db:migrate) and the Firebase service account. Every account gets
 * SEED_PASSWORD, so the demo logins always work after a seed, even against a reused Firebase project.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { closePool, query } from '../src/config/db.js';
import { dbConnectionOptions, dbErrorHint } from '../src/config/dbConnection.js';
import { env } from '../src/config/env.js';
import { assertFirebaseReady, firebase } from '../src/config/firebase.js';
import { ACADEMIC_YEAR_START_MONTH } from '../src/constants/shared.js';
import { createUserAccount } from '../src/modules/users/users.service.js';
import * as usersRepository from '../src/modules/users/users.repository.js';
import { todayYmd } from '../src/utils/dates.js';

const YEAR = todayYmd().slice(0, 4);
const number = (prefix, sequence) => `${prefix}-${YEAR}-${String(sequence).padStart(4, '0')}`;

const ADMINS = [
  { email: 'admin@school.test', firstName: 'Amara', lastName: 'Johnson' },
  { email: 'admin2@school.test', firstName: 'Noah', lastName: 'Bennett' },
];

// Subjects and classes in seed.sql refer to these teachers and students by e-mail.
const TEACHERS = [
  { firstName: 'Alice', lastName: 'Morgan', department: 'Mathematics', qualification: 'MSc Mathematics' },
  { firstName: 'Brian', lastName: 'Chen', department: 'Humanities', qualification: 'MA English Literature' },
  { firstName: 'Carla', lastName: 'Diaz', department: 'Sciences', qualification: 'MSc Biochemistry' },
];

const STUDENTS = [
  ['Daniel', 'Okafor', 'male', '2010-03-14'],
  ['Sofia', 'Martins', 'female', '2010-07-02'],
  ['Liam', 'Walker', 'male', '2010-11-21'],
  ['Grace', 'Kim', 'female', '2010-01-30'],
  ['Hiro', 'Tanaka', 'male', '2010-05-09'],
  ['Zoe', 'Petrov', 'female', '2010-09-17'],
  ['Lucas', 'Silva', 'male', '2010-12-05'],
  ['Hana', 'Haddad', 'female', '2010-04-26'],
];

const accounts = [
  ...ADMINS.map((admin) => ({ ...admin, role: 'admin' })),
  ...TEACHERS.map(({ firstName, lastName, ...profile }, index) => ({
    email: `teacher${index + 1}@school.test`,
    role: 'teacher',
    firstName,
    lastName,
    profile: { ...profile, employeeNumber: number('EMP', index + 1), hireDate: `${Number(YEAR) - 3}-08-15` },
  })),
  ...STUDENTS.map(([firstName, lastName, gender, dateOfBirth], index) => ({
    email: `student${index + 1}@school.test`,
    role: 'student',
    firstName,
    lastName,
    profile: {
      studentNumber: number('STU', index + 1),
      gender,
      dateOfBirth,
      guardianName: `${lastName} Family`,
      guardianPhone: `+1555010${String(index + 1).padStart(4, '0')}`,
    },
  })),
];

/** The MySQL row exists (previous seed): make Firebase match it again and reset the demo password. */
async function relinkAccount(existing, password) {
  let firebaseUser;
  try {
    firebaseUser = await firebase.getUserByEmail(existing.email);
    // A deactivated account stays unable to sign in.
    await firebase.updateUser(firebaseUser.uid, { password, disabled: !existing.isActive });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    firebaseUser = await firebase.createUser({
      email: existing.email,
      password,
      displayName: `${existing.firstName} ${existing.lastName}`,
      emailVerified: true,
    });
  }
  if (firebaseUser.uid !== existing.firebaseUid) {
    await usersRepository.relinkFirebaseUid(existing.id, firebaseUser.uid);
    return 'relinked';
  }
  return 'kept';
}

async function findFirebaseUser(email) {
  try {
    return await firebase.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

/**
 * No MySQL row yet. A demo account's Firebase user usually exists already: the Firebase project is
 * shared with the other database (local and live). It is linked as it is, so the other database keeps
 * working, after its password is reset and its sessions are revoked (nobody else keeps using it).
 */
async function createAccount(account, password) {
  const firebaseUser = await findFirebaseUser(account.email);
  if (!firebaseUser) {
    await createUserAccount({ ...account, password }, { trusted: true });
    return 'created';
  }
  await firebase.updateUser(firebaseUser.uid, { password, disabled: false, emailVerified: true });
  await firebase.revokeRefreshTokens(firebaseUser.uid);
  await createUserAccount({ ...account, password }, { trusted: true, firebaseUid: firebaseUser.uid });
  return 'linked';
}

async function seedAccounts() {
  const password = env.SEED_PASSWORD;
  for (const account of accounts) {
    const existing = await usersRepository.findUserByEmail(account.email);
    const outcome = existing
      ? await relinkAccount(existing, password)
      : await createAccount(account, password);
    console.log(`  ${outcome.padEnd(8)} ${account.role.padEnd(8)} ${account.email}`);
  }
}

const schoolClockTime = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: env.APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

/** Runs seed.sql (subjects, classes, enrollments, timetable, attendance, grades, announcements). */
async function seedSchoolData() {
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM subjects');
  if (total > 0) {
    console.log('  skipped  school data already present (npm run db:reset starts from scratch)');
    return;
  }
  const sql = readFileSync(path.join(env.backendRoot, 'database', 'seed.sql'), 'utf8');
  const conn = await mysql.createConnection({
    ...dbConnectionOptions(),
    database: env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
  });
  try {
    await conn.query("SET time_zone = '+00:00'");
    await conn.query(
      'SET @today = CAST(? AS DATE), @now_time = CAST(? AS TIME), @now = CAST(? AS DATETIME), @ay_start_month = ?',
      [
        todayYmd(),
        schoolClockTime(),
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        ACADEMIC_YEAR_START_MONTH,
      ],
    );
    await conn.query(sql);
    console.log('  loaded   subjects, classes, enrollments, timetable, attendance, grades, announcements');
  } finally {
    await conn.end();
  }
}

/** Accounts first (Firebase + MySQL), then the school data. Exported for tests. */
export async function seed() {
  console.log('Accounts:');
  await seedAccounts();
  console.log('School data:');
  await seedSchoolData();
}

async function main() {
  assertFirebaseReady();
  console.log(`Seeding ${env.DB_NAME} (Firebase project ${firebase.projectId})`);
  if (!process.env.SEED_PASSWORD && !['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST)) {
    console.warn(
      `! ${env.DB_HOST} is not this machine and SEED_PASSWORD is not set: every demo account, admins included,\n` +
        `  gets the password published in the README. Set SEED_PASSWORD for a site that is not a public demo.`,
    );
  }
  await seed();
  console.log(`✔ Seed complete. Sign in with any account above, password: ${env.SEED_PASSWORD}`);
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error(`✖ Seeding failed: ${error.code ?? ''} ${error.message}`);
      const hint = dbErrorHint(error);
      if (hint) console.error(`  ${hint}`);
      if (error.sqlMessage) console.error(`  ${error.sqlMessage}`);
      process.exitCode = 1;
    })
    .finally(closePool);
}
