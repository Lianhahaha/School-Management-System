import './helpers/setup.js';
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it, mock } from 'node:test';
import request from 'supertest';
import { query } from '../src/config/db.js';
import { CLASS_SEATS, PAGINATION } from '../src/constants/shared.js';
import {
  academicYearStart,
  addDaysYmd,
  currentAcademicYear,
  currentSemester,
  isoWeekdayOf,
  todayYmd,
} from '../src/utils/dates.js';
import { averageOf } from '../src/utils/grading.js';
import { bearer } from './helpers/fakeFirebase.js';
import {
  APPLICATION_FIELDS,
  PRIVACY_CONSENT,
  app,
  as,
  closeWorld,
  makeUser,
  resetWorld,
} from './helpers/harness.js';

/**
 * One listening server and kept-alive connections for the whole file. It sends a few thousand requests, and
 * supertest's default (a new server and a new socket per request) can run Windows out of ephemeral ports
 * (EADDRINUSE) when the rest of the suite has just run.
 */
const server = http.createServer(app);
server.keepAliveTimeout = 60_000;
const connections = new http.Agent({ keepAlive: true });
let client;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  client = request(`http://127.0.0.1:${server.address().port}`);
});

after(async () => {
  connections.destroy();
  await new Promise((resolve) => server.close(resolve));
  await closeWorld();
});

/**
 * Every role's dashboard and lists agree with each other and with the database, on a realistic school built
 * through the API by its own people: the admin and an approved student assistant set the year up, teachers
 * mark attendance and grade, students sign up and pick a section. Each figure is checked three ways: the
 * dashboard, the list endpoint the page behind it reads, and the test database read directly (plain SQL, the
 * rules worked out again in this file, not the app's queries).
 *
 * The clock is pinned (only Date is mocked; APP_TIMEZONE is UTC in the tests) to Wednesday 2025-10-08 of the
 * 2025-2026 school year, the app's current year while the test runs. It is a day in the past on purpose: an
 * announcement is live while MySQL's own clock (UTC_TIMESTAMP) has passed its publish time, so a pinned day
 * after the real one would hide every announcement. 2025-08-21 is a holiday; the days used are school days.
 *
 *   Grade 7 - Rizal      homeroom Bautista. Ana, Ben (weak, often absent), Ella, Fely; Carla until she moves to
 *                        Bonifacio on 2025-10-06; Dino until he is withdrawn on 2025-10-03.
 *   Grade 7 - Bonifacio  homeroom Aquino. Gino, Hana, Ivan signed up and picked it themselves; Carla from 10-06.
 *   Grade 8 - Mabini     homeroom Bautista (who teaches nothing there). Jose, Kara (weak), Leo, Mia.
 *   Grade 8 - Luna       no homeroom teacher. Nico, Olga, Paolo.
 *   No class             Quinn signed up for Grade 7 and never picked a section (a pending application).
 *
 *   Aquino teaches Mathematics in both Grade 7 sections, Bautista English in both, Castro Mathematics in both
 *   Grade 8 sections and English in Mabini, Delos Santos Values (Rizal, Mabini) and MAPEH (Bonifacio, Luna).
 *   Mathematics is K-12 math and science, English K-12 languages, MAPEH K-12 MAPEH, Values on points.
 *
 * Every lesson meets on Wednesdays. All sheets of 2025-10-01 are marked; today only some are. Assessments of the
 * 1st Semester have scores and a few blanks (a blank counts 0 once the assessment is given); one dated today and
 * one on Friday have no score yet. Mylene Ocampo is the approved student assistant, Noel Pineda still waits.
 */

const YEAR = '2025-2026';
const YEAR_START = academicYearStart(YEAR);
const SETUP_DAY = '2025-08-04'; // Monday: the year is set up and the students join their classes
const HOLIDAY = '2025-08-21'; // Thursday: Ninoy Aquino Day
const QUIZ_DAY = '2025-09-10';
const PROJECT_DAY = '2025-09-24';
const PAST_DAY = '2025-10-01'; // Wednesday: a past school day, every sheet marked
const WITHDRAW_DAY = '2025-10-03'; // Friday: Dino leaves the school
const TRANSFER_DAY = '2025-10-06'; // Monday: Carla moves to Bonifacio
const QUIZ_TWO_DAY = '2025-10-07';
const TODAY = '2025-10-08'; // Wednesday
const UNIT_TEST_DAY = '2025-10-10'; // Friday: an assessment still to come
const EVENT_DAY = '2025-10-17'; // the Science Fair
const WEEKDAY = isoWeekdayOf(TODAY);
const NEXT_WEEK = addDaysYmd(TODAY, 7);

/** Moves the school's clock to `time` (HH:MM) of `ymd`. */
const at = (ymd, time = '09:00') => mock.timers.setTime(Date.parse(`${ymd}T${time}:00Z`));

const TEACHERS = {
  aquino: { firstName: 'Teresa', lastName: 'Aquino', department: 'Mathematics' },
  bautista: { firstName: 'Hector', lastName: 'Bautista', department: 'English' },
  castro: { firstName: 'Lorna', lastName: 'Castro', department: 'Mathematics' },
  delos: { firstName: 'Ramon', lastName: 'Delos Santos', department: 'MAPEH' },
};

const SUBJECTS = {
  math: { code: 'MATH', name: 'Mathematics', gradingGroup: 'math_science' },
  english: { code: 'ENG', name: 'English', gradingGroup: 'languages' },
  mapeh: { code: 'MAPEH', name: 'MAPEH', gradingGroup: 'mapeh' },
  values: { code: 'VAL', name: 'Values Education' },
};

const CLASSES = {
  rizal: { name: 'Grade 7 - Rizal', gradeLevel: 7, homeroom: 'bautista', room: 'Room 7R' },
  bonifacio: { name: 'Grade 7 - Bonifacio', gradeLevel: 7, homeroom: 'aquino', room: 'Room 7B' },
  mabini: { name: 'Grade 8 - Mabini', gradeLevel: 8, homeroom: 'bautista', room: 'Room 8M' },
  luna: { name: 'Grade 8 - Luna', gradeLevel: 8, homeroom: null, room: 'Room 8L' },
};

/** `class.subject` -> the teacher who teaches it. */
const LESSONS = {
  'rizal.math': 'aquino',
  'bonifacio.math': 'aquino',
  'rizal.english': 'bautista',
  'bonifacio.english': 'bautista',
  'mabini.math': 'castro',
  'luna.math': 'castro',
  'mabini.english': 'castro',
  'rizal.values': 'delos',
  'mabini.values': 'delos',
  'bonifacio.mapeh': 'delos',
  'luna.mapeh': 'delos',
};

/** The weekly timetable: [lesson, ISO weekday, start, end]. Luna's Mathematics has a double period today. */
const TIMETABLE = [
  ['rizal.math', 3, '08:00', '09:00'],
  ['bonifacio.english', 3, '08:00', '09:00'],
  ['mabini.math', 3, '08:00', '09:00'],
  ['luna.mapeh', 3, '08:00', '09:00'],
  ['bonifacio.math', 3, '09:00', '10:00'],
  ['rizal.english', 3, '09:00', '10:00'],
  ['luna.math', 3, '09:00', '10:00'],
  ['mabini.values', 3, '09:00', '10:00'],
  ['rizal.values', 3, '10:00', '11:00'],
  ['mabini.english', 3, '10:00', '11:00'],
  ['bonifacio.mapeh', 3, '11:00', '12:00'],
  ['luna.math', 3, '13:00', '14:00'],
  ['rizal.math', 1, '08:00', '09:00'],
  ['mabini.math', 1, '08:00', '09:00'],
  ['bonifacio.math', 1, '09:00', '10:00'],
  ['luna.math', 1, '09:00', '10:00'],
];

/** The sheets marked today; the others are still to mark. */
const MARKED_TODAY = [
  'rizal.math',
  'bonifacio.math',
  'rizal.english',
  'bonifacio.english',
  'rizal.values',
  'mabini.math',
];

/**
 * `joins`: the class they start in (null: none). `signsUp`: signed up themselves (Bonifacio's pick their section,
 * Quinn never does); the others are created by the office. `ability`: the share of each maximum score they get.
 * `marks`: their attendance marks in the order they are taken (P present, A absent, L late, E excused).
 */
const STUDENTS = {
  ana: { firstName: 'Ana', lastName: 'Reyes', joins: 'rizal', ability: 0.95, marks: 'PPPPPP' },
  ben: { firstName: 'Ben', lastName: 'Santos', joins: 'rizal', ability: 0.45, marks: 'AALAEA' },
  carla: { firstName: 'Carla', lastName: 'Cruz', joins: 'rizal', ability: 0.8, marks: 'PLPPEP' },
  dino: { firstName: 'Dino', lastName: 'Garcia', joins: 'rizal', ability: 0.7, marks: 'PAP' },
  ella: { firstName: 'Ella', lastName: 'Mendoza', joins: 'rizal', ability: 0.85, marks: 'PPLPPP' },
  fely: { firstName: 'Fely', lastName: 'Torres', joins: 'rizal', ability: 0.6, marks: 'EPPAPP' },
  gino: { firstName: 'Gino', lastName: 'Ramos', joins: 'bonifacio', signsUp: true, ability: 0.9, marks: '' },
  hana: {
    firstName: 'Hana',
    lastName: 'Flores',
    joins: 'bonifacio',
    signsUp: true,
    ability: 0.75,
    marks: 'PL',
  },
  ivan: {
    firstName: 'Ivan',
    lastName: 'Castillo',
    joins: 'bonifacio',
    signsUp: true,
    ability: 0.65,
    marks: 'PPAPE',
  },
  jose: { firstName: 'Jose', lastName: 'Navarro', joins: 'mabini', ability: 0.88, marks: '' },
  kara: { firstName: 'Kara', lastName: 'Villanueva', joins: 'mabini', ability: 0.5, marks: 'ALAA' },
  leo: { firstName: 'Leo', lastName: 'Aquino', joins: 'mabini', ability: 0.78, marks: 'PPEP' },
  mia: { firstName: 'Mia', lastName: 'Bautista', joins: 'mabini', ability: 0.92, marks: '' },
  nico: { firstName: 'Nico', lastName: 'Domingo', joins: 'luna', ability: 0.7, marks: '' },
  olga: { firstName: 'Olga', lastName: 'Pascual', joins: 'luna', ability: 0.83, marks: 'LP' },
  paolo: { firstName: 'Paolo', lastName: 'Rivera', joins: 'luna', ability: 0.55, marks: 'PA' },
  quinn: { firstName: 'Quinn', lastName: 'Salazar', joins: null, signsUp: true, ability: 0, marks: '' },
};

const MARK = { P: 'present', A: 'absent', L: 'late', E: 'excused' };

/** The 1st Semester's assessments, each given in its `lessons`; `ungraded` ones have no score yet. */
const ASSESSMENTS = {
  'Quiz 1': { type: 'quiz', maxScore: 20, term: 'term1', date: QUIZ_DAY, lessons: Object.keys(LESSONS) },
  'Project 1': {
    type: 'project',
    maxScore: 50,
    term: 'term1',
    date: PROJECT_DAY,
    lessons: ['rizal.math', 'bonifacio.math', 'mabini.math', 'luna.math', 'bonifacio.mapeh', 'luna.mapeh'],
  },
  'Q1 Exam': {
    type: 'exam',
    maxScore: 50,
    term: 'term1',
    date: PAST_DAY,
    lessons: ['rizal.math', 'bonifacio.math', 'rizal.english', 'mabini.english', 'rizal.values'],
  },
  Reflection: {
    type: 'assignment',
    maxScore: 10,
    term: 'term2',
    date: TRANSFER_DAY,
    lessons: ['rizal.values'],
  },
  'Quiz 2': {
    type: 'quiz',
    maxScore: 20,
    term: 'term2',
    date: QUIZ_TWO_DAY,
    lessons: ['rizal.math', 'bonifacio.math'],
  },
  'Reading Test': {
    type: 'test',
    maxScore: 30,
    term: 'term2',
    date: TODAY,
    lessons: ['mabini.english'],
    ungraded: true,
  },
  'Unit Test': {
    type: 'test',
    maxScore: 40,
    term: 'term2',
    date: UNIT_TEST_DAY,
    lessons: ['luna.math'],
    ungraded: true,
  },
};

/** `title@lesson` -> the students on its roster without a score (a blank). */
const BLANKS = {
  'Project 1@rizal.math': ['ben'],
  'Reflection@rizal.values': ['ben'],
  'Quiz 1@rizal.english': ['fely'],
  'Quiz 1@mabini.values': ['kara'],
  'Project 1@luna.mapeh': ['paolo'],
  'Quiz 2@bonifacio.math': ['ivan'],
};

/** The at-risk lines of the dashboards (dashboard/atRisk.service.js). */
const AT_RISK = { attendanceRateBelow: 0.8, minAttendanceMarks: 5, gradeAverageBelow: 75 };

// ---------------------------------------------------------------------------------------------------------------
// Requests

/** Every response of the run, setup included, for the closing check that none was a server error. */
const responses = [];

const describeRequest = (who, method, path, params) =>
  `${who?.label ?? 'signed out'}: ${method.toUpperCase()} ${path}${params ? ` ${JSON.stringify(params)}` : ''}`;

/** Sends one request as `who` (null: signed out) and logs its status. */
async function send(who, method, path, { params, body } = {}) {
  let pending = client[method](`/api/v1${path}`).agent(connections);
  if (who) pending = pending.set(as(who));
  if (params) pending = pending.query(params);
  if (body !== undefined) pending = pending.send(body);
  const res = await pending;
  responses.push({ request: describeRequest(who, method, path, params), status: res.status });
  return res;
}

/** The body of a request that must answer `status`. */
async function ok(who, method, path, options = {}, status = 200) {
  const res = await send(who, method, path, options);
  assert.equal(
    res.status,
    status,
    `${describeRequest(who, method, path, options.params)} -> ${JSON.stringify(res.body)}`,
  );
  return res.body;
}

/** `data` of a GET. */
const read = async (who, path, params) => (await ok(who, 'get', path, { params })).data;

/** `data` of a POST that must create a record (201). */
const create = async (who, path, body) => (await ok(who, 'post', path, { body }, 201)).data;

/** `data` of a write that must succeed (200). */
const change = async (who, method, path, body) => (await ok(who, method, path, { body })).data;

/** `meta.total` of a list. */
const totalOf = async (who, path, params = {}) =>
  (await ok(who, 'get', path, { params: { ...params, limit: 1 } })).meta.total;

/** Every row of a list, page by page; the pages must add up to `meta.total`. */
async function everyRow(who, path, params = {}) {
  const rows = [];
  for (let number = 1; ; number += 1) {
    const { data, meta } = await ok(who, 'get', path, {
      params: { ...params, page: number, limit: PAGINATION.MAX_LIMIT },
    });
    rows.push(...data);
    if (number >= meta.totalPages) {
      assert.equal(rows.length, meta.total, `${describeRequest(who, 'get', path, params)}: pages = total`);
      return rows;
    }
  }
}

/** A request the API must refuse with 403 and this `details.reason`. */
async function refused(who, method, path, reason, options = {}) {
  const res = await send(who, method, path, options);
  const what = `${describeRequest(who, method, path, options.params)} -> ${JSON.stringify(res.body)}`;
  assert.equal(res.status, 403, what);
  assert.equal(res.body.error.details?.reason, reason, what);
}

/** The office's answer to a GET, read once: nothing changes after the school is built. */
const officeAnswers = new Map();
function officeRead(path, params) {
  const key = `${path} ${JSON.stringify(params ?? {})}`;
  if (!officeAnswers.has(key)) officeAnswers.set(key, read(school.admin, path, params));
  return officeAnswers.get(key);
}

const dashboardOf = (who) => read(who, '/dashboard');

const ids = (rows) => rows.map((row) => row.id);
const sorted = (values) => [...values].sort((a, b) => a - b);
const sameIds = (actual, expected, message) => assert.deepEqual(sorted(actual), sorted(expected), message);
const ratio = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 10000) / 10000 : null;

/** `{ total, present, absent, late, excused, rate }` of attendance marks, counted the API's way. */
function tally(marks) {
  const count = (status) => marks.filter((mark) => mark.status === status).length;
  const [present, absent, late, excused] = ['present', 'absent', 'late', 'excused'].map(count);
  return { total: marks.length, present, absent, late, excused, rate: ratio(present + late, marks.length) };
}

const countsOf = ({ total, present, absent, late, excused, rate }) => ({
  total,
  present,
  absent,
  late,
  excused,
  rate,
});

const announcementBrief = ({ id, title, audience, className, publishedAt }) => ({
  id,
  title,
  audience,
  className,
  publishedAt,
});

const eventBrief = ({ id, title, type, startsOn, endsOn }) => ({ id, title, type, startsOn, endsOn });

const assessmentBrief = (row) => ({
  id: row.id,
  title: row.title,
  type: row.type,
  assessedOn: row.assessedOn,
  className: row.classSubject.className,
  subjectName: row.classSubject.subjectName,
});

// ---------------------------------------------------------------------------------------------------------------
// The school

const school = { teachers: {}, subjects: {}, classes: {}, lessons: {}, students: {} };
const studentKeyOf = new Map(); // studentId -> key in STUDENTS
const marksTaken = new Map(); // student key -> marks taken so far

/** The database as the API left it, read once the school is built. */
let db;

const PASSWORD = 'Password123!';
const emailOf = (firstName, lastName) =>
  `${firstName}.${lastName.replace(/\s+/g, '')}@school.test`.toLowerCase();
const signedIn = (account, label) => ({ ...account, auth: bearer(account.firebaseUid), label });

/** An account the school office creates (POST /users). */
async function officeCreates(actor, role, { firstName, lastName }, profile = {}) {
  const email = emailOf(firstName, lastName);
  const account = await create(actor, '/users', {
    role,
    email,
    password: PASSWORD,
    firstName,
    lastName,
    profile,
  });
  return signedIn(account, `${role} ${firstName} ${lastName}`);
}

/** Someone signing up on the public form (POST /auth/register). */
async function signUp({ firstName, lastName }, fields, label) {
  const email = emailOf(firstName, lastName);
  const account = await create(null, '/auth/register', {
    email,
    password: PASSWORD,
    firstName,
    lastName,
    ...fields,
  });
  return signedIn(account, `${label} ${firstName} ${lastName}`);
}

const teacherOf = (lessonKey) => school.teachers[LESSONS[lessonKey]];

/** The teacher marks the lesson's sheet of `date` for everyone on it, each student's next mark. */
async function markSheet(lessonKey, date) {
  const teacher = teacherOf(lessonKey);
  const classSubjectId = school.lessons[lessonKey].id;
  const sheet = await read(teacher, '/attendance/sheet', { classSubjectId, date });
  const records = sheet.records.map(({ studentId }) => {
    const key = studentKeyOf.get(studentId);
    const taken = marksTaken.get(key) ?? 0;
    marksTaken.set(key, taken + 1);
    return { studentId, status: MARK[STUDENTS[key].marks[taken] ?? 'P'] };
  });
  await change(teacher, 'put', '/attendance/sheet', { classSubjectId, date, records });
}

/** The teacher gives the assessment in each of its lessons and records the scores (blanks left out). */
async function assess(title) {
  const { lessons, ungraded, date, ...fields } = ASSESSMENTS[title];
  for (const lessonKey of lessons) {
    const teacher = teacherOf(lessonKey);
    const classSubjectId = school.lessons[lessonKey].id;
    const { id } = await create(teacher, '/assessments', {
      classSubjectId,
      title,
      ...fields,
      semester: 'sem1',
      assessedOn: date,
    });
    if (ungraded) continue;
    const { records } = await read(teacher, `/assessments/${id}/grades`);
    const blanks = BLANKS[`${title}@${lessonKey}`] ?? [];
    const grades = records
      .map(({ studentId }) => ({ studentId, key: studentKeyOf.get(studentId) }))
      .filter(({ key }) => !blanks.includes(key))
      .map(({ studentId, key }) => ({
        studentId,
        score: Math.round(fields.maxScore * STUDENTS[key].ability),
      }));
    assert.ok(grades.length > 0, `${title} of ${lessonKey} is given`);
    await change(teacher, 'put', `/assessments/${id}/grades`, { grades });
  }
}

async function buildSchool() {
  at(SETUP_DAY, '07:00');
  const admin = { ...(await makeUser('admin', { firstName: 'Rosa', lastName: 'Mercado' })), label: 'admin' };
  school.admin = admin;

  // Two student assistants sign up; the admin approves one, the other is still waiting.
  const asAssistant = { accountType: 'assistant', ...PRIVACY_CONSENT };
  school.assistant = await signUp({ firstName: 'Mylene', lastName: 'Ocampo' }, asAssistant, 'assistant');
  school.pendingAssistant = await signUp(
    { firstName: 'Noel', lastName: 'Pineda' },
    asAssistant,
    'pending assistant',
  );
  await change(admin, 'post', `/assistant-requests/${school.assistant.id}/approve`);
  const office = school.assistant;

  for (const [key, teacher] of Object.entries(TEACHERS)) {
    school.teachers[key] = await officeCreates(admin, 'teacher', teacher, { department: teacher.department });
  }
  for (const [key, subject] of Object.entries(SUBJECTS)) {
    school.subjects[key] = await create(admin, '/subjects', subject);
  }
  for (const [key, { name, gradeLevel, homeroom }] of Object.entries(CLASSES)) {
    const homeroomTeacherId = homeroom ? school.teachers[homeroom].teacherId : null;
    school.classes[key] = await create(office, '/classes', {
      name,
      gradeLevel,
      academicYear: YEAR,
      homeroomTeacherId,
    });
  }
  for (const [lessonKey, teacherKey] of Object.entries(LESSONS)) {
    const [classKey, subjectKey] = lessonKey.split('.');
    school.lessons[lessonKey] = await create(admin, '/class-subjects', {
      classId: school.classes[classKey].id,
      subjectId: school.subjects[subjectKey].id,
      teacherId: school.teachers[teacherKey].teacherId,
    });
  }
  for (const [lessonKey, dayOfWeek, startTime, endTime] of TIMETABLE) {
    const classSubjectId = school.lessons[lessonKey].id;
    const { room } = CLASSES[lessonKey.split('.')[0]];
    await create(office, '/schedules', { classSubjectId, dayOfWeek, startTime, endTime, room });
  }
  await create(admin, '/calendar-events', { title: 'Ninoy Aquino Day', type: 'holiday', startsOn: HOLIDAY });
  await create(office, '/calendar-events', { title: 'Science Fair', type: 'event', startsOn: EVENT_DAY });

  // The office creates most students and enrolls them; Bonifacio's sign up and pick their section, Quinn never does.
  for (const [key, student] of Object.entries(STUDENTS)) {
    school.students[key] = student.signsUp
      ? await signUp(student, { ...APPLICATION_FIELDS, gradeLevel: 7 }, 'student')
      : await officeCreates(office, 'student', student);
    studentKeyOf.set(school.students[key].studentId, key);
  }
  for (const [classKey, actor] of [
    ['rizal', office],
    ['mabini', admin],
    ['luna', admin],
  ]) {
    const studentIds = Object.keys(STUDENTS)
      .filter((key) => STUDENTS[key].joins === classKey && !STUDENTS[key].signsUp)
      .map((key) => school.students[key].studentId);
    await create(actor, '/enrollments/bulk', { classId: school.classes[classKey].id, studentIds });
  }
  for (const [key, { signsUp, joins }] of Object.entries(STUDENTS)) {
    if (signsUp && joins)
      await create(school.students[key], '/enrollments/next-class', { classId: school.classes[joins].id });
  }

  at(QUIZ_DAY, '10:00');
  await assess('Quiz 1');
  at(PROJECT_DAY, '10:00');
  await assess('Project 1');
  at(PAST_DAY, '10:00');
  for (const lessonKey of Object.keys(LESSONS)) await markSheet(lessonKey, PAST_DAY);
  await assess('Q1 Exam');

  at(WITHDRAW_DAY, '10:00');
  const { studentId: dinoId } = school.students.dino;
  const [dinoEnrollment] = await everyRow(office, '/enrollments', { studentId: dinoId, status: 'active' });
  await change(office, 'patch', `/enrollments/${dinoEnrollment.id}`, { status: 'withdrawn' });

  at(TRANSFER_DAY, '10:00');
  const carlaMoves = { studentId: school.students.carla.studentId, classId: school.classes.bonifacio.id };
  await create(office, '/enrollments/transfer', carlaMoves);
  await assess('Reflection');
  at(QUIZ_TWO_DAY, '10:00');
  await assess('Quiz 2');

  // Today: notices before the first period, then the sheets of the lessons taught so far.
  const notices = [
    [admin, { title: 'Welcome to the second quarter', body: 'Classes resume as usual.', audience: 'all' }],
    [office, { title: 'Faculty meeting', body: 'In the library at four.', audience: 'teachers' }],
    [
      school.teachers.bautista,
      {
        title: 'Rizal field trip',
        body: 'Bring the form.',
        audience: 'students',
        classId: school.classes.rizal.id,
      },
    ],
  ];
  for (const [index, [author, notice]] of notices.entries()) {
    at(TODAY, `07:${index}0`);
    await create(author, '/announcements', notice);
  }
  at(TODAY, '11:00');
  for (const lessonKey of MARKED_TODAY) await markSheet(lessonKey, TODAY);
  await assess('Reading Test');
  await assess('Unit Test');
  // Some have read every notice they can see; the others have not.
  for (const reader of [school.students.ana, school.teachers.castro, school.assistant]) {
    await change(reader, 'post', '/announcements/read', {});
  }
  at(TODAY, '12:00');
}

/** The tables the checks read, straight from MySQL (row keys camelCased by the db helper). */
const TABLES = {
  users: 'SELECT id, role, is_active FROM users',
  students: 'SELECT id, user_id FROM students',
  classes: 'SELECT id, name, grade_level, academic_year, homeroom_teacher_id FROM classes',
  subjects: 'SELECT id, is_active FROM subjects',
  classSubjects: 'SELECT id, class_id, subject_id, teacher_id FROM class_subjects',
  schedules: 'SELECT id, class_subject_id, day_of_week, start_time, end_time FROM schedules',
  enrollments: 'SELECT id, student_id, class_id, status, enrolled_on, left_on FROM enrollments',
  attendance: 'SELECT id, student_id, class_subject_id, attendance_date, status FROM attendance',
  assessments: 'SELECT id, class_subject_id, title, semester, term, max_score, assessed_on FROM assessments',
  grades: 'SELECT id, assessment_id, student_id, score FROM grades',
  // `live`: published and not expired, by MySQL's clock, as the API decides it.
  announcements: `SELECT id, author_id, audience, class_id, published_at,
      published_at <= UTC_TIMESTAMP() AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) AS live
    FROM announcements`,
  announcementReads: 'SELECT user_id, announcement_id FROM announcement_reads',
  events: 'SELECT id, type, starts_on, ends_on FROM calendar_events',
  admissions: 'SELECT student_id, status FROM admissions',
  assistantRequests: 'SELECT user_id, status FROM assistant_requests',
  notifications: 'SELECT id, user_id, read_at FROM notifications',
};

async function loadDatabase() {
  const tables = Object.fromEntries(
    await Promise.all(Object.entries(TABLES).map(async ([name, sql]) => [name, await query(sql)])),
  );
  tables.announcements = tables.announcements.map((row) => ({ ...row, live: Boolean(row.live) }));
  return tables;
}

/** The scalar of a one-row, one-column SQL query. */
const sqlValue = async (sql, params = []) => Number(Object.values((await query(sql, params))[0])[0]);

// ---------------------------------------------------------------------------------------------------------------
// The rules, worked out again from the tables

const lessonById = (id) => db.classSubjects.find((lesson) => lesson.id === id);
const classById = (id) => db.classes.find((klass) => klass.id === id);
const yearOfLesson = (lessonId) => classById(lessonById(lessonId).classId).academicYear;
const isActiveStudent = (studentId) => {
  const { userId } = db.students.find((student) => student.id === studentId);
  return db.users.find((user) => user.id === userId).isActive;
};
const activeEnrollmentOf = (studentId) =>
  db.enrollments.find((row) => row.studentId === studentId && row.status === 'active') ?? null;
/** In class `classId` on `day`: enrolled on or before it and not yet left (a mover belongs to the new class). */
const inClassOn = (enrollment, classId, day) =>
  enrollment.classId === classId &&
  enrollment.enrolledOn <= day &&
  (enrollment.leftOn === null || enrollment.leftOn > day);
const classHasStudentsOn = (classId, day) => db.enrollments.some((row) => inClassOn(row, classId, day));

/** Taught classes plus homeroom classes. */
const visibleClassIds = (teacherId) =>
  new Set([
    ...db.classSubjects.filter((lesson) => lesson.teacherId === teacherId).map((lesson) => lesson.classId),
    ...db.classes.filter((klass) => klass.homeroomTeacherId === teacherId).map((klass) => klass.id),
  ]);
const lessonIdsIn = (classIds) =>
  new Set(db.classSubjects.filter((lesson) => classIds.has(lesson.classId)).map((lesson) => lesson.id));

/** An assessment's roster: the class on its date, and anyone already graded on it. */
function rosterOf(assessment) {
  const { classId } = lessonById(assessment.classSubjectId);
  return new Set([
    ...db.enrollments
      .filter((row) => inClassOn(row, classId, assessment.assessedOn))
      .map((row) => row.studentId),
    ...db.grades.filter((grade) => grade.assessmentId === assessment.id).map((grade) => grade.studentId),
  ]);
}
const gradedCount = (assessment) => db.grades.filter((grade) => grade.assessmentId === assessment.id).length;

/** Active students in a class of this year, among `classIds` (all classes when left out). */
const enrolledThisYear = (classIds) =>
  db.enrollments.filter(
    (row) =>
      row.status === 'active' &&
      classById(row.classId).academicYear === YEAR &&
      isActiveStudent(row.studentId) &&
      (!classIds || classIds.has(row.classId)),
  );

/** Announcements `user` may read: the office all; a teacher's and a student's by audience and class. */
function visibleAnnouncements(user) {
  if (user.role === 'admin' || user.role === 'assistant') return db.announcements.filter((row) => row.live);
  if (user.role === 'teacher') {
    const classIds = visibleClassIds(user.teacherId);
    return db.announcements.filter(
      (row) =>
        (row.live &&
          ((row.classId === null && ['all', 'teachers'].includes(row.audience)) ||
            classIds.has(row.classId))) ||
        row.authorId === user.id,
    );
  }
  const classId = activeEnrollmentOf(user.studentId)?.classId ?? null;
  return db.announcements.filter(
    (row) =>
      row.live &&
      ['all', 'students'].includes(row.audience) &&
      (row.classId === null || row.classId === classId),
  );
}
/** Newest first, as every announcement list and the dashboards order them. */
const newestFirst = (a, b) => b.publishedAt - a.publishedAt || b.id - a.id;

/** Live notices by someone else that `user` has not marked read (the "New" count). */
const unreadAnnouncements = (user) =>
  visibleAnnouncements(user).filter(
    (row) =>
      row.live &&
      row.authorId !== user.id &&
      !db.announcementReads.some((read) => read.userId === user.id && read.announcementId === row.id),
  );

/**
 * The at-risk list worked out from the caller's attendance summary per student and the general averages:
 * attendance below the line once there are enough marks, or a general average below the passing grade.
 */
function expectedAtRisk(enrolled, attendanceRows, averages) {
  const attendanceOf = new Map(attendanceRows.map((row) => [row.studentId, row]));
  return enrolled
    .map(({ studentId, classId }) => {
      const marks = attendanceOf.get(studentId);
      const gradeAverage = averages.get(studentId) ?? null;
      const reasons = [];
      if (marks && marks.total >= AT_RISK.minAttendanceMarks && marks.rate < AT_RISK.attendanceRateBelow) {
        reasons.push('attendance');
      }
      if (gradeAverage !== null && gradeAverage < AT_RISK.gradeAverageBelow) reasons.push('grades');
      const attendance = marks ? { rate: marks.rate, marks: marks.total } : null;
      return { studentId, classId, attendance, gradeAverage, reasons };
    })
    .filter((student) => student.reasons.length > 0)
    .sort((a, b) => a.studentId - b.studentId);
}

/** Compares a dashboard's at-risk list with the expected one, and checks it is worst first. */
function assertAtRisk(atRisk, expected, who) {
  assert.deepEqual(
    [atRisk.attendanceRateBelow, atRisk.minAttendanceMarks, atRisk.gradeAverageBelow],
    [AT_RISK.attendanceRateBelow, AT_RISK.minAttendanceMarks, AT_RISK.gradeAverageBelow],
  );
  assert.equal(atRisk.total, expected.length, `${who}: at-risk total`);
  const listed = atRisk.students
    .map(({ studentId, classId, attendance, gradeAverage, reasons }) => ({
      studentId,
      classId,
      attendance,
      gradeAverage,
      reasons,
    }))
    .sort((a, b) => a.studentId - b.studentId);
  assert.deepEqual(listed, expected, `${who}: at-risk students`);
  const shortfall = (student) =>
    Math.max(
      student.reasons.includes('attendance')
        ? (AT_RISK.attendanceRateBelow - student.attendance.rate) * 100
        : 0,
      student.reasons.includes('grades') ? AT_RISK.gradeAverageBelow - student.gradeAverage : 0,
    );
  atRisk.students.slice(1).forEach((student, index) => {
    const before = atRisk.students[index];
    assert.ok(
      before.reasons.length > student.reasons.length ||
        (before.reasons.length === student.reasons.length && shortfall(before) >= shortfall(student)),
      `${who}: the at-risk list is worst first`,
    );
  });
}

/** studentId -> general average of the school year, as the office reads it. */
async function generalAverages() {
  const rows = await officeRead('/grades/summary', { groupBy: 'student', academicYear: YEAR });
  return new Map(rows.map((row) => [row.studentId, row.percentage]));
}

/** The calendar page's range: Monday on or before the 1st to Sunday on or after the last day of today's month. */
function monthRange() {
  const first = `${TODAY.slice(0, 8)}01`;
  const last = addDaysYmd(`${addDaysYmd(first, 31).slice(0, 8)}01`, -1);
  return {
    dateFrom: addDaysYmd(first, 1 - isoWeekdayOf(first)),
    dateTo: addDaysYmd(last, 7 - isoWeekdayOf(last)),
  };
}
/** The schedule page's week, Monday to Sunday. */
const weekRange = () => ({
  dateFrom: addDaysYmd(TODAY, 1 - WEEKDAY),
  dateTo: addDaysYmd(TODAY, 7 - WEEKDAY),
});

// ---------------------------------------------------------------------------------------------------------------

describe('every role sees the same school', () => {
  before(async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.parse(`${SETUP_DAY}T07:00:00Z`) });
    await resetWorld();
    await buildSchool();
    db = await loadDatabase();
  });

  after(() => mock.timers.reset());

  it('is the school described above, on a Wednesday school day of the current year', () => {
    assert.deepEqual([todayYmd(), currentAcademicYear(), currentSemester()], [TODAY, YEAR, 'sem1']);
    assert.deepEqual(
      [SETUP_DAY, PAST_DAY, TRANSFER_DAY, TODAY].map(isoWeekdayOf),
      [1, 3, 1, 3],
      'Monday set-up, Wednesday lessons, Monday move',
    );
    assert.ok(!db.events.some((e) => e.type === 'holiday' && e.startsOn <= TODAY && e.endsOn >= TODAY));
    assert.equal(db.users.filter((user) => user.role === 'student').length, 17);
    assert.equal(db.enrollments.filter((row) => row.status === 'active').length, 15);
    assert.deepEqual(
      new Map(
        db.enrollments.filter((row) => row.status !== 'active').map((row) => [row.studentId, row.status]),
      ),
      new Map([
        [school.students.dino.studentId, 'withdrawn'],
        [school.students.carla.studentId, 'transferred'],
      ]),
    );
    // 2025-10-01: Rizal 3 lessons x 6, Bonifacio 3 x 3, Mabini 3 x 4, Luna 2 x 3; today 6 sheets x 4 students.
    assert.equal(db.attendance.length, 45 + 24);
    // Quiz 1 43, Project 1 20, Q1 Exam 25, Reflection 3, Quiz 2 7 scores; the six blanks have none.
    assert.equal(db.grades.length, 43 + 20 + 25 + 3 + 7);
  });

  describe('admin', () => {
    it('dashboard counts = the office lists = the database', async () => {
      const { counts } = await dashboardOf(school.admin);
      const activeStudentsInYear = `FROM enrollments e JOIN classes c ON c.id = e.class_id
        JOIN students s ON s.id = e.student_id JOIN users u ON u.id = s.user_id
        WHERE e.status = 'active' AND u.is_active = 1 AND c.academic_year = ?`;
      const fromDatabase = {
        students: await sqlValue("SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 1"),
        teachers: await sqlValue("SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1"),
        classes: await sqlValue('SELECT COUNT(*) FROM classes WHERE academic_year = ?', [YEAR]),
        subjects: await sqlValue('SELECT COUNT(*) FROM subjects WHERE is_active = 1'),
        teacherAssignments: await sqlValue(
          'SELECT COUNT(*) FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE c.academic_year = ?',
          [YEAR],
        ),
        timetableSlots: await sqlValue(
          `SELECT COUNT(*) FROM schedules sch JOIN class_subjects cs ON cs.id = sch.class_subject_id
             JOIN classes c ON c.id = cs.class_id WHERE c.academic_year = ?`,
          [YEAR],
        ),
        activeEnrollments: await sqlValue(`SELECT COUNT(*) ${activeStudentsInYear}`, [YEAR]),
        unenrolledStudents: await sqlValue(
          `SELECT COUNT(*) FROM students s JOIN users u ON u.id = s.user_id
            WHERE u.is_active = 1
              AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active')
              AND NOT EXISTS (SELECT 1 FROM admissions ad WHERE ad.student_id = s.id AND ad.status = 'declined')`,
        ),
      };
      const fromLists = {
        students: await totalOf(school.admin, '/students', { isActive: 'true' }),
        teachers: await totalOf(school.admin, '/teachers', { isActive: 'true' }),
        classes: await totalOf(school.admin, '/classes', { academicYear: YEAR }),
        subjects: await totalOf(school.admin, '/subjects', { isActive: 'true' }),
        teacherAssignments: await totalOf(school.admin, '/class-subjects', { academicYear: YEAR }),
        timetableSlots: await totalOf(school.admin, '/schedules', { academicYear: YEAR }),
        activeEnrollments: await totalOf(school.admin, '/students', {
          hasActiveEnrollment: 'true',
          academicYear: YEAR,
          isActive: 'true',
        }),
        unenrolledStudents: await totalOf(school.admin, '/students', {
          hasActiveEnrollment: 'false',
          isActive: 'true',
        }),
      };
      assert.deepEqual(counts, fromDatabase, 'dashboard = database');
      assert.deepEqual(counts, fromLists, 'dashboard = the lists its tiles open');
      assert.deepEqual(counts, {
        students: 17,
        teachers: 4,
        classes: 4,
        subjects: 4,
        teacherAssignments: 11,
        timetableSlots: 16,
        activeEnrollments: 15,
        unenrolledStudents: 2,
      });
      assert.equal(
        await totalOf(school.admin, '/enrollments', { status: 'active', academicYear: YEAR }),
        counts.activeEnrollments,
      );
      // The two without a class are the withdrawn student and the applicant who never picked a section.
      const unenrolled = await everyRow(school.admin, '/students', {
        hasActiveEnrollment: 'false',
        isActive: 'true',
      });
      sameIds(ids(unenrolled), [school.students.dino.studentId, school.students.quinn.studentId]);
    });

    it('enrollments by grade add up to the active enrollments, grade by grade', async () => {
      const { enrollmentsByGrade, counts } = await dashboardOf(school.admin);
      const fromDatabase = await query(
        `SELECT c.grade_level, COUNT(*) AS students FROM enrollments e JOIN classes c ON c.id = e.class_id
           JOIN students s ON s.id = e.student_id JOIN users u ON u.id = s.user_id
          WHERE e.status = 'active' AND u.is_active = 1 AND c.academic_year = ?
          GROUP BY c.grade_level ORDER BY c.grade_level`,
        [YEAR],
      );
      assert.deepEqual(enrollmentsByGrade, fromDatabase);
      assert.deepEqual(enrollmentsByGrade, [
        { gradeLevel: 7, students: 8 },
        { gradeLevel: 8, students: 7 },
      ]);
      for (const { gradeLevel, students } of enrollmentsByGrade) {
        const listed = await totalOf(school.admin, '/students', {
          hasActiveEnrollment: 'true',
          academicYear: YEAR,
          isActive: 'true',
          gradeLevel,
        });
        assert.equal(listed, students, `Grade ${gradeLevel}`);
      }
      assert.equal(
        enrollmentsByGrade.reduce((sum, row) => sum + row.students, 0),
        counts.activeEnrollments,
      );
    });

    it("today's attendance: the marks, the periods marked and the sheets still to mark", async () => {
      const { attendanceToday } = await dashboardOf(school.admin);
      const { date, lessonsScheduled, lessonsMarked, unmarkedLessons, ...marks } = attendanceToday;
      assert.equal(date, TODAY);
      assert.deepEqual(marks, tally(db.attendance.filter((row) => row.attendanceDate === TODAY)), 'database');
      assert.deepEqual(
        marks,
        await read(school.admin, '/attendance/summary', { dateFrom: TODAY, dateTo: TODAY }),
        'the attendance summary',
      );

      // Periods of today in a class with students today (all of them here), a double period counted twice.
      const markedLessons = new Set(
        db.attendance.filter((row) => row.attendanceDate === TODAY).map((row) => row.classSubjectId),
      );
      const periods = db.schedules
        .filter((slot) => slot.dayOfWeek === WEEKDAY && yearOfLesson(slot.classSubjectId) === YEAR)
        .filter(
          (slot) =>
            markedLessons.has(slot.classSubjectId) ||
            classHasStudentsOn(lessonById(slot.classSubjectId).classId, TODAY),
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id);
      assert.equal(lessonsScheduled, periods.length);
      assert.equal(lessonsMarked, periods.filter((slot) => markedLessons.has(slot.classSubjectId)).length);
      assert.deepEqual([lessonsScheduled, lessonsMarked], [12, 6]);

      const sheets = new Map();
      for (const slot of periods.filter((period) => !markedLessons.has(period.classSubjectId))) {
        sheets.set(slot.classSubjectId, [...(sheets.get(slot.classSubjectId) ?? []), slot]);
      }
      assert.deepEqual(
        unmarkedLessons.map((lesson) => ({
          classSubjectId: lesson.classSubjectId,
          classId: lesson.classId,
          teacherId: lesson.teacher.id,
          startTime: lesson.startTime,
          periods: lesson.periods,
        })),
        [...sheets.entries()]
          .sort(([, a], [, b]) => a[0].startTime.localeCompare(b[0].startTime))
          .map(([classSubjectId, slots]) => ({
            classSubjectId,
            classId: lessonById(classSubjectId).classId,
            teacherId: lessonById(classSubjectId).teacherId,
            startTime: slots[0].startTime,
            periods: slots.map(({ startTime, endTime }) => ({ startTime, endTime })),
          })),
      );
      assert.equal(unmarkedLessons.length, 5, 'six periods, five sheets: the double period shares one');

      // The same from the office's timetable and attendance lists.
      const slotsToday = await everyRow(school.admin, '/schedules', {
        dayOfWeek: WEEKDAY,
        academicYear: YEAR,
      });
      assert.equal(slotsToday.length, lessonsScheduled);
      const markedFromList = new Set(
        (await everyRow(school.admin, '/attendance', { dateFrom: TODAY, dateTo: TODAY })).map(
          (row) => row.classSubjectId,
        ),
      );
      assert.equal(
        slotsToday.filter((slot) => markedFromList.has(slot.classSubjectId)).length,
        lessonsMarked,
      );
      sameIds(
        unmarkedLessons.map((lesson) => lesson.classSubjectId),
        [...new Set(slotsToday.map((slot) => slot.classSubjectId).filter((id) => !markedFromList.has(id)))],
      );
    });

    it('upcoming assessments, recent announcements and events = their lists = the database', async () => {
      const dashboard = await dashboardOf(school.admin);
      const ungradedSoon = db.assessments
        .filter((a) => a.assessedOn >= TODAY && a.assessedOn <= NEXT_WEEK && gradedCount(a) === 0)
        .sort((a, b) => a.assessedOn.localeCompare(b.assessedOn) || a.id - b.id);
      assert.deepEqual(ids(dashboard.upcomingAssessments), ids(ungradedSoon).slice(0, 5));
      assert.equal(dashboard.upcomingAssessmentsTotal, ungradedSoon.length);
      assert.deepEqual(
        dashboard.upcomingAssessments.map((a) => a.title),
        ['Reading Test', 'Unit Test'],
      );
      const listed = await everyRow(school.admin, '/assessments', {
        dateFrom: TODAY,
        dateTo: NEXT_WEEK,
        sortBy: 'assessedOn',
        sortOrder: 'asc',
      });
      assert.deepEqual(
        dashboard.upcomingAssessments,
        listed
          .filter((a) => a.gradedCount === 0)
          .slice(0, 5)
          .map(assessmentBrief),
      );

      const notices = await read(school.admin, '/announcements', { page: 1, limit: 20 });
      assert.deepEqual(dashboard.recentAnnouncements, notices.slice(0, 5).map(announcementBrief));
      assert.deepEqual(
        ids(dashboard.recentAnnouncements),
        ids(visibleAnnouncements(school.admin).sort(newestFirst)).slice(0, 5),
      );
      assert.equal(dashboard.recentAnnouncements.length, 3);

      const soon = addDaysYmd(TODAY, 30);
      const events = db.events
        .filter((e) => e.endsOn >= TODAY && e.startsOn <= soon)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id);
      assert.deepEqual(ids(dashboard.upcomingEvents), ids(events).slice(0, 5));
      assert.deepEqual(
        dashboard.upcomingEvents,
        (await read(school.admin, '/calendar-events', { dateFrom: TODAY, dateTo: soon })).map(eventBrief),
      );
      assert.equal(dashboard.holidayToday, null);
    });

    it('the at-risk list = the attendance summary and the general averages the office reads', async () => {
      const { atRisk } = await dashboardOf(school.admin);
      const attendance = await read(school.admin, '/attendance/summary', {
        groupBy: 'student',
        dateFrom: YEAR_START,
        dateTo: TODAY,
      });
      const expected = expectedAtRisk(enrolledThisYear(), attendance, await generalAverages());
      assertAtRisk(atRisk, expected, 'admin');
      assert.ok(
        atRisk.students.some((s) => s.studentId === school.students.ben.studentId && s.reasons.length === 2),
        'Ben: both lines',
      );
      // Each student's marks of the year, from the table.
      for (const row of attendance) {
        const marks = db.attendance.filter(
          (mark) =>
            mark.studentId === row.studentId &&
            mark.attendanceDate >= YEAR_START &&
            mark.attendanceDate <= TODAY,
        );
        assert.deepEqual(countsOf(row), tally(marks), `student ${row.studentId}`);
      }
    });

    it('the student assistant requests and applications = the database', async () => {
      const pending = await everyRow(school.admin, '/assistant-requests', { status: 'pending' });
      assert.deepEqual(
        pending.map((row) => row.userId),
        db.assistantRequests.filter((row) => row.status === 'pending').map((row) => row.userId),
      );
      assert.deepEqual(
        pending.map((row) => row.userId),
        [school.pendingAssistant.id],
      );
      const approved = await everyRow(school.admin, '/assistant-requests', { status: 'approved' });
      assert.deepEqual(
        approved.map((row) => [row.userId, row.decidedBy.id]),
        [[school.assistant.id, school.admin.id]],
      );
      const applicants = await everyRow(school.admin, '/students', {
        admissionStatus: 'pending',
        isActive: 'true',
      });
      sameIds(
        ids(applicants),
        db.admissions.filter((row) => row.status === 'pending').map((row) => row.studentId),
      );
      assert.deepEqual(ids(applicants), [school.students.quinn.studentId]);
      const admitted = db.admissions.filter((row) => row.status === 'admitted').map((row) => row.studentId);
      sameIds(
        admitted,
        ['gino', 'hana', 'ivan'].map((key) => school.students[key].studentId),
      );
    });
  });

  describe('approved student assistant', () => {
    it("gets the admin's dashboard and the office lists, row for row", async () => {
      assert.deepEqual(await dashboardOf(school.assistant), await dashboardOf(school.admin));
      const withoutReadMark = (rows) => rows.map(({ isRead: _isRead, ...row }) => row);
      for (const path of [
        '/students',
        '/teachers',
        '/classes',
        '/subjects',
        '/class-subjects',
        '/schedules',
        '/enrollments',
        '/attendance',
        '/grades',
        '/assessments',
        '/calendar-events',
        '/assistant-requests',
        '/announcements',
      ]) {
        assert.deepEqual(
          withoutReadMark(await everyRow(school.assistant, path)),
          withoutReadMark(await everyRow(school.admin, path)),
          path,
        );
      }
      for (const params of [
        { groupBy: 'student', academicYear: YEAR },
        { groupBy: 'classSubject', academicYear: YEAR },
      ]) {
        assert.deepEqual(
          await read(school.assistant, '/grades/summary', params),
          await officeRead('/grades/summary', params),
        );
      }
    });

    it('is refused what only an admin does, and nothing changes', async () => {
      const { assistant, students, classes, lessons, teachers } = school;
      const [assessment] = db.assessments;
      const [grade] = db.grades;
      const anaEnrollment = activeEnrollmentOf(students.ana.studentId);
      const attempts = [
        ['get', '/users'],
        ['get', `/users/${school.admin.id}`],
        ['patch', `/users/${students.ana.id}/status`, { isActive: false }],
        ['delete', `/users/${students.quinn.id}`],
        ['patch', `/subjects/${db.subjects[0].id}`, { name: 'Science' }],
        ['delete', `/classes/${classes.luna.id}`],
        ['delete', `/class-subjects/${lessons['luna.mapeh'].id}`],
        ['patch', `/teachers/${teachers.aquino.teacherId}`, { department: 'Science' }],
        [
          'post',
          '/enrollments/complete',
          { classId: classes.rizal.id, studentIds: [students.ana.studentId] },
        ],
        ['patch', `/enrollments/${anaEnrollment.id}`, { status: 'completed' }],
        [
          'put',
          '/attendance/sheet',
          {
            classSubjectId: lessons['rizal.math'].id,
            date: TODAY,
            records: [{ studentId: students.ana.studentId, status: 'absent' }],
          },
        ],
        [
          'post',
          '/assessments',
          {
            classSubjectId: lessons['rizal.math'].id,
            title: 'Quiz 3',
            type: 'quiz',
            term: 'term2',
            maxScore: 10,
          },
        ],
        [
          'put',
          `/assessments/${assessment.id}/grades`,
          { grades: [{ studentId: students.ana.studentId, score: 1 }] },
        ],
        ['delete', `/grades/${grade.id}`],
      ];
      for (const [method, path, body] of attempts) {
        await refused(assistant, method, path, 'role_not_allowed', { body });
      }
      assert.deepEqual(await loadDatabase(), db, 'the refused requests changed nothing');
    });
  });

  describe('student assistant awaiting approval', () => {
    it('reads their own account only; every office page answers 403 assistant_not_approved', async () => {
      const pending = school.pendingAssistant;
      const me = await read(pending, '/auth/me');
      assert.deepEqual([me.role, me.assistantRequest.status], ['assistant', 'pending']);
      for (const [path, params] of [
        ['/dashboard'],
        ['/notifications/unread-count'],
        ['/notifications'],
        ['/announcements', { unread: 'true', limit: 1 }],
        ['/students', { hasActiveEnrollment: 'false', isActive: 'true', limit: 1 }],
        ['/students', { admissionStatus: 'pending', isActive: 'true', limit: 1 }],
        ['/assistant-requests', { status: 'pending', limit: 1 }],
        ['/teachers'],
        ['/classes'],
        ['/attendance'],
        ['/grades/summary'],
        ['/calendar-events'],
        ['/activity'],
      ]) {
        await refused(pending, 'get', path, 'assistant_not_approved', { params });
      }
      await refused(pending, 'post', '/calendar-events', 'assistant_not_approved', {
        body: { title: 'Sports Day', type: 'event', startsOn: EVENT_DAY },
      });
      await refused(pending, 'post', `/assistant-requests/${pending.id}/approve`, 'assistant_not_approved');
      assert.equal(
        db.assistantRequests.find((row) => row.userId === pending.id).status,
        'pending',
        'still waiting',
      );
    });
  });

  describe('teachers', () => {
    for (const teacherKey of Object.keys(TEACHERS)) {
      const name = `${TEACHERS[teacherKey].firstName} ${TEACHERS[teacherKey].lastName}`;

      it(`${name}: the dashboard = their own lists = the database`, async () => {
        const teacher = school.teachers[teacherKey];
        const { teacherId } = teacher;
        const dashboard = await dashboardOf(teacher);
        assert.equal(dashboard.role, 'teacher');
        assert.equal(dashboard.teacher.id, teacherId);
        assert.equal(dashboard.holidayToday, null);

        // Lessons this year, with their class's head count.
        const taught = await everyRow(teacher, '/class-subjects', { teacherId: 'me', academicYear: YEAR });
        assert.deepEqual(ids(dashboard.classSubjects), ids(taught));
        sameIds(
          ids(taught),
          db.classSubjects
            .filter((l) => l.teacherId === teacherId && yearOfLesson(l.id) === YEAR)
            .map((l) => l.id),
        );
        for (const lesson of dashboard.classSubjects) {
          const inClass = db.enrollments.filter(
            (row) => row.classId === lesson.classId && row.status === 'active',
          );
          assert.equal(lesson.studentCount, inClass.length, `${lesson.className}: database`);
          assert.equal(lesson.studentCount, (await read(teacher, `/classes/${lesson.classId}`)).studentCount);
          assert.equal(lesson.studentCount, await totalOf(teacher, '/students', { classId: lesson.classId }));
        }

        const homeroom = await everyRow(teacher, '/classes', { homeroomTeacherId: 'me', academicYear: YEAR });
        assert.deepEqual(
          dashboard.homeroomClasses,
          homeroom.map(({ id, name: className, academicYear, studentCount }) => ({
            id,
            name: className,
            academicYear,
            studentCount,
          })),
        );
        sameIds(
          ids(homeroom),
          db.classes
            .filter((c) => c.homeroomTeacherId === teacherId && c.academicYear === YEAR)
            .map((c) => c.id),
        );

        // Today's periods, each marked or not.
        const markedToday = new Set(
          db.attendance.filter((row) => row.attendanceDate === TODAY).map((row) => row.classSubjectId),
        );
        const slots = await everyRow(teacher, '/schedules', {
          teacherId: 'me',
          dayOfWeek: WEEKDAY,
          academicYear: YEAR,
        });
        assert.deepEqual(
          dashboard.todaySchedule,
          slots.map((slot) => ({
            scheduleId: slot.id,
            classSubjectId: slot.classSubjectId,
            className: slot.classSubject.className,
            subjectName: slot.classSubject.subjectName,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            attendanceMarked: markedToday.has(slot.classSubjectId),
          })),
        );
        assert.deepEqual(
          dashboard.todaySchedule.map((period) => period.scheduleId),
          db.schedules
            .filter(
              (slot) =>
                slot.dayOfWeek === WEEKDAY &&
                lessonById(slot.classSubjectId).teacherId === teacherId &&
                yearOfLesson(slot.classSubjectId) === YEAR,
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id)
            .map((slot) => slot.id),
        );
        for (const period of dashboard.todaySchedule) {
          const sheet = await read(teacher, '/attendance/sheet', {
            classSubjectId: period.classSubjectId,
            date: TODAY,
          });
          assert.equal(
            period.attendanceMarked,
            sheet.records.some((row) => row.status !== null),
          );
        }
        assert.deepEqual(dashboard.attendanceToday, {
          sessionsScheduled: dashboard.todaySchedule.length,
          sessionsMarked: dashboard.todaySchedule.filter((period) => period.attendanceMarked).length,
        });

        // Assessments up to today that a roster student still lacks a score on.
        const pending = db.assessments
          .filter((a) => {
            const lesson = lessonById(a.classSubjectId);
            return (
              lesson.teacherId === teacherId && yearOfLesson(lesson.id) === YEAR && a.assessedOn <= TODAY
            );
          })
          .map((a) => ({
            assessmentId: a.id,
            assessedOn: a.assessedOn,
            gradedCount: gradedCount(a),
            enrolledCount: rosterOf(a).size,
          }))
          .filter((row) => row.gradedCount < row.enrolledCount)
          .sort((a, b) => b.assessedOn.localeCompare(a.assessedOn));
        assert.deepEqual(
          dashboard.pendingGrading.map(({ assessmentId, assessedOn, gradedCount, enrolledCount }) => ({
            assessmentId,
            assessedOn,
            gradedCount,
            enrolledCount,
          })),
          pending.slice(0, 10),
          'database',
        );
        const mine = await everyRow(teacher, '/assessments', { sortBy: 'assessedOn', sortOrder: 'desc' });
        assert.deepEqual(
          dashboard.pendingGrading,
          mine
            .filter(
              (a) =>
                a.classSubject.teacherId === teacherId &&
                a.classSubject.academicYear === YEAR &&
                a.assessedOn <= TODAY &&
                a.gradedCount < a.enrolledCount,
            )
            .map((a) => ({
              assessmentId: a.id,
              title: a.title,
              className: a.classSubject.className,
              subjectName: a.classSubject.subjectName,
              assessedOn: a.assessedOn,
              gradedCount: a.gradedCount,
              enrolledCount: a.enrolledCount,
            })),
          'the assessments list',
        );

        const notices = await read(teacher, '/announcements', { page: 1, limit: 20 });
        assert.deepEqual(
          dashboard.recentAnnouncements,
          notices
            .filter((a) => a.status === 'active')
            .slice(0, 5)
            .map(announcementBrief),
        );
        assert.deepEqual(
          ids(dashboard.recentAnnouncements),
          ids(
            visibleAnnouncements(teacher)
              .filter((a) => a.live)
              .sort(newestFirst),
          ).slice(0, 5),
        );

        // At risk: the students of their classes, attendance within those classes, the whole year's average.
        const visible = visibleClassIds(teacherId);
        const attendance = await read(teacher, '/attendance/summary', {
          groupBy: 'student',
          dateFrom: YEAR_START,
          dateTo: TODAY,
        });
        const visibleLessons = lessonIdsIn(visible);
        for (const row of attendance) {
          const marks = db.attendance.filter(
            (mark) =>
              mark.studentId === row.studentId &&
              visibleLessons.has(mark.classSubjectId) &&
              mark.attendanceDate >= YEAR_START &&
              mark.attendanceDate <= TODAY,
          );
          assert.deepEqual(countsOf(row), tally(marks), `student ${row.studentId}, in ${name}'s classes`);
        }
        assertAtRisk(
          dashboard.atRisk,
          expectedAtRisk(enrolledThisYear(visible), attendance, await generalAverages()),
          name,
        );

        assert.deepEqual(dashboard.upcomingEvents, (await dashboardOf(school.admin)).upcomingEvents);
      });

      it(`${name}: every list holds exactly the rows of their classes, and other classes are refused`, async () => {
        const teacher = school.teachers[teacherKey];
        const visible = visibleClassIds(teacher.teacherId);
        const visibleLessons = lessonIdsIn(visible);
        const lessonsOfAssessments = new Map(db.assessments.map((a) => [a.id, a.classSubjectId]));
        const expected = {
          '/classes?visible': [...visible],
          '/class-subjects': [...visibleLessons],
          '/schedules': db.schedules.filter((s) => visibleLessons.has(s.classSubjectId)).map((s) => s.id),
          '/enrollments': db.enrollments.filter((e) => visible.has(e.classId)).map((e) => e.id),
          '/students': db.enrollments
            .filter((e) => e.status === 'active' && visible.has(e.classId))
            .map((e) => e.studentId),
          '/attendance': db.attendance.filter((a) => visibleLessons.has(a.classSubjectId)).map((a) => a.id),
          '/assessments': db.assessments.filter((a) => visibleLessons.has(a.classSubjectId)).map((a) => a.id),
          '/grades': db.grades
            .filter((g) => visibleLessons.has(lessonsOfAssessments.get(g.assessmentId)))
            .map((g) => g.id),
          '/announcements': ids(visibleAnnouncements(teacher)),
        };
        for (const [list, expectedIds] of Object.entries(expected)) {
          const rows =
            list === '/classes?visible'
              ? await everyRow(teacher, '/classes', { visible: 'true' })
              : await everyRow(teacher, list);
          sameIds(ids(rows), expectedIds, `${name} ${list}`);
        }

        const others = db.classes.filter((klass) => !visible.has(klass.id));
        for (const klass of others) {
          await refused(teacher, 'get', '/attendance', 'class_not_visible', {
            params: { classId: klass.id },
          });
          await refused(teacher, 'get', '/students', 'class_not_visible', { params: { classId: klass.id } });
          const stranger = db.enrollments.find((e) => e.status === 'active' && e.classId === klass.id);
          await refused(teacher, 'get', `/students/${stranger.studentId}`, 'student_not_visible');
        }
        for (const path of ['/teachers', '/users', '/activity', '/assistant-requests']) {
          await refused(teacher, 'get', path, 'role_not_allowed');
        }
      });

      it(`${name}: reads each lesson of their classes exactly as the office does`, async () => {
        const teacher = school.teachers[teacherKey];
        const visibleLessons = [...lessonIdsIn(visibleClassIds(teacher.teacherId))];
        for (const classSubjectId of visibleLessons) {
          for (const [path, params] of [
            [`/class-subjects/${classSubjectId}`],
            ['/schedules', { classSubjectId }],
            ['/attendance/summary', { classSubjectId }],
            ['/attendance/summary', { classSubjectId, groupBy: 'student' }],
            ['/attendance', { classSubjectId, limit: 100 }],
            ['/attendance/sheet', { classSubjectId, date: PAST_DAY }],
            ['/attendance/sheet', { classSubjectId, date: TODAY }],
            ['/assessments', { classSubjectId, limit: 100 }],
            ['/grades', { classSubjectId, limit: 100 }],
            ['/grades/summary', { classSubjectId }],
            ['/grades/summary', { classSubjectId, groupBy: 'student' }],
            ['/grades/summary', { classSubjectId, academicYear: YEAR, semester: 'sem1' }],
          ]) {
            assert.deepEqual(
              await read(teacher, path, params),
              await officeRead(path, params),
              `${name} and the office: ${path} ${JSON.stringify(params ?? {})}`,
            );
          }
          // The lesson's figures, from the tables.
          const lessonAssessments = new Set(
            db.assessments.filter((a) => a.classSubjectId === classSubjectId).map((a) => a.id),
          );
          assert.deepEqual(
            await officeRead('/attendance/summary', { classSubjectId }),
            tally(db.attendance.filter((row) => row.classSubjectId === classSubjectId)),
          );
          sameIds(
            ids(await officeRead('/grades', { classSubjectId, limit: 100 })),
            db.grades.filter((grade) => lessonAssessments.has(grade.assessmentId)).map((grade) => grade.id),
          );
          for (const assessment of db.assessments.filter((a) => a.classSubjectId === classSubjectId)) {
            const path = `/assessments/${assessment.id}/grades`;
            const roster = await read(teacher, path);
            assert.deepEqual(roster, await officeRead(path), `${name}: roster of ${assessment.title}`);
            sameIds(
              roster.records.map((row) => row.studentId),
              [...rosterOf(assessment)],
              `roster of ${assessment.title}`,
            );
          }
        }
      });
    }
  });

  describe('students', () => {
    for (const studentKey of Object.keys(STUDENTS)) {
      const name = `${STUDENTS[studentKey].firstName} ${STUDENTS[studentKey].lastName}`;

      it(`${name}: the dashboard = their own lists = the office's view = the database`, async () => {
        const kid = school.students[studentKey];
        const { studentId } = kid;
        const dashboard = await dashboardOf(kid);
        const enrollment = activeEnrollmentOf(studentId);
        const record = await officeRead(`/students/${studentId}`);
        assert.equal(dashboard.role, 'student');
        const own = await read(kid, '/students/me');
        assert.deepEqual(own, record, 'their record, as the office reads it');
        assert.deepEqual(dashboard.student, {
          id: studentId,
          studentNumber: record.studentNumber,
          firstName: record.firstName,
          lastName: record.lastName,
        });

        // The class.
        const me = await read(kid, '/auth/me');
        assert.deepEqual(me.currentEnrollment, record.currentEnrollment);
        assert.equal(record.currentEnrollment?.classId ?? null, enrollment?.classId ?? null, 'database');
        if (enrollment) {
          const klass = await officeRead(`/classes/${enrollment.classId}`);
          // The enrollment exactly as /auth/me gives it, plus the class's homeroom teacher.
          assert.deepEqual(dashboard.currentEnrollment, {
            ...me.currentEnrollment,
            homeroomTeacher: klass.homeroomTeacher,
          });
          assert.equal(dashboard.currentEnrollment.className, klass.name);
        } else {
          assert.equal(dashboard.currentEnrollment, null);
        }

        // Today's lessons: their class's periods of the weekday.
        const ownToday = await everyRow(kid, '/schedules', { dayOfWeek: WEEKDAY });
        const officeToday = enrollment
          ? await everyRow(school.admin, '/schedules', { classId: enrollment.classId, dayOfWeek: WEEKDAY })
          : [];
        assert.deepEqual(ownToday, officeToday);
        assert.deepEqual(
          dashboard.todaySchedule,
          ownToday.map((slot) => ({
            scheduleId: slot.id,
            classSubjectId: slot.classSubjectId,
            subjectName: slot.classSubject.subjectName,
            teacher: slot.classSubject.teacher,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
          })),
        );
        assert.deepEqual(
          dashboard.todaySchedule.map((period) => period.scheduleId),
          db.schedules
            .filter(
              (slot) =>
                slot.dayOfWeek === WEEKDAY && lessonById(slot.classSubjectId).classId === enrollment?.classId,
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id)
            .map((slot) => slot.id),
        );

        // Attendance of the school year so far.
        const range = { dateFrom: YEAR_START, dateTo: TODAY };
        const ownAttendance = await read(kid, '/attendance/summary', { studentId: 'me', ...range });
        assert.deepEqual(dashboard.attendanceSummary, { ...range, ...ownAttendance });
        assert.deepEqual(ownAttendance, await officeRead('/attendance/summary', { studentId, ...range }));
        assert.deepEqual(
          ownAttendance,
          tally(
            db.attendance.filter(
              (row) =>
                row.studentId === studentId &&
                row.attendanceDate >= YEAR_START &&
                row.attendanceDate <= TODAY,
            ),
          ),
          'database',
        );

        // Newest grades (with or without a class), upcoming assessments of their class, notices.
        const ownGrades = await read(kid, '/grades', { limit: 5 });
        assert.deepEqual(
          dashboard.recentGrades,
          ownGrades.map((grade) => ({
            gradeId: grade.id,
            assessmentId: grade.assessmentId,
            title: grade.assessment.title,
            type: grade.assessment.type,
            subjectName: grade.assessment.subjectName,
            score: grade.score,
            maxScore: grade.assessment.maxScore,
            percentage: grade.percentage,
            assessedOn: grade.assessment.assessedOn,
          })),
        );
        const assessedOnOf = new Map(db.assessments.map((a) => [a.id, a.assessedOn]));
        assert.deepEqual(
          ids(ownGrades),
          db.grades
            .filter((grade) => grade.studentId === studentId)
            .sort(
              (a, b) =>
                assessedOnOf.get(b.assessmentId).localeCompare(assessedOnOf.get(a.assessmentId)) ||
                b.id - a.id,
            )
            .slice(0, 5)
            .map((grade) => grade.id),
        );

        const soon = await everyRow(kid, '/assessments', {
          dateFrom: TODAY,
          dateTo: NEXT_WEEK,
          sortBy: 'assessedOn',
          sortOrder: 'asc',
        });
        const upcoming = soon.filter((a) => a.gradedCount === 0);
        assert.deepEqual(dashboard.upcomingAssessments, upcoming.slice(0, 5).map(assessmentBrief));
        assert.equal(dashboard.upcomingAssessmentsTotal, upcoming.length);
        assert.deepEqual(
          ids(dashboard.upcomingAssessments),
          db.assessments
            .filter(
              (a) =>
                enrollment &&
                lessonById(a.classSubjectId).classId === enrollment.classId &&
                a.assessedOn >= TODAY &&
                a.assessedOn <= NEXT_WEEK &&
                gradedCount(a) === 0,
            )
            .sort((a, b) => a.assessedOn.localeCompare(b.assessedOn) || a.id - b.id)
            .map((a) => a.id),
        );

        const notices = await read(kid, '/announcements', { page: 1, limit: 10 });
        assert.deepEqual(dashboard.recentAnnouncements, notices.slice(0, 5).map(announcementBrief));
        assert.deepEqual(
          ids(dashboard.recentAnnouncements),
          ids(visibleAnnouncements(kid).sort(newestFirst)).slice(0, 5),
        );
        assert.deepEqual(dashboard.upcomingEvents, (await dashboardOf(school.admin)).upcomingEvents);
      });

      it(`${name}: their grade summary, general average and standing = what the office sees`, async () => {
        const kid = school.students[studentKey];
        const { studentId } = kid;
        const enrollment = activeEnrollmentOf(studentId);
        const dashboard = await dashboardOf(kid);

        // The summaries the Grades page reads, and the year's, as the office reads them.
        for (const params of [{ academicYear: YEAR }, { academicYear: YEAR, semester: 'sem1' }, {}]) {
          assert.deepEqual(
            await read(kid, '/grades/summary', { studentId: 'me', ...params }),
            await officeRead('/grades/summary', { studentId, ...params }),
            JSON.stringify(params),
          );
        }
        const yearRows = await officeRead('/grades/summary', { studentId, academicYear: YEAR });
        const [average] = await officeRead('/grades/summary', {
          groupBy: 'student',
          studentId,
          academicYear: YEAR,
        });
        assert.equal((await generalAverages()).get(studentId) ?? null, average?.percentage ?? null);

        // One dashboard row per subject, with or without a class; a subject taken in one class is that class's row.
        for (const row of dashboard.gradeSummary) {
          const classRows = yearRows.filter((summary) => summary.subjectId === row.subjectId);
          assert.deepEqual(
            row.classSubjectIds,
            classRows.map((summary) => summary.classSubjectId),
          );
          assert.equal(
            row.className,
            [...new Set(classRows.map((summary) => summary.className))].join(' / '),
          );
          assert.equal(
            row.assessmentsGraded,
            classRows.reduce((sum, summary) => sum + summary.assessmentsGraded, 0),
          );
          if (classRows.length === 1) assert.equal(row.percentage, classRows[0].percentage, row.subjectName);
        }
        sameIds(
          dashboard.gradeSummary.map((row) => row.subjectId),
          [...new Set(yearRows.map((row) => row.subjectId))],
        );
        // The dashboard's subject grades average to the general average the office reads.
        assert.equal(
          averageOf(dashboard.gradeSummary.map((row) => row.percentage)),
          average?.percentage ?? null,
        );

        // Where they stand for next year.
        const standing = await read(kid, '/enrollments/next-class');
        const record = await officeRead(`/students/${studentId}`);
        if (record.currentEnrollment) {
          const { classId, className, gradeLevel, academicYear } = record.currentEnrollment;
          assert.equal(standing.status, 'enrolled');
          assert.deepEqual(standing.lastClass, { id: classId, name: className, gradeLevel, academicYear });
        } else if (record.admission?.status === 'pending') {
          assert.deepEqual(
            [standing.status, standing.gradeLevel, standing.academicYear],
            ['new', record.admission.gradeLevel, YEAR],
          );
          const sections = await everyRow(school.admin, '/classes', {
            academicYear: YEAR,
            gradeLevel: record.admission.gradeLevel,
          });
          assert.deepEqual(
            standing.classes.map((klass) => [klass.id, klass.enrolled, klass.seats]),
            sections.map((klass) => [klass.id, klass.studentCount, CLASS_SEATS]),
          );
        } else {
          const history = await everyRow(school.admin, '/enrollments', { studentId });
          assert.ok(!history.some((row) => ['active', 'completed'].includes(row.status)), 'no year to judge');
          assert.equal(standing.status, 'needs_placement');
        }
        const expectedStatus = { dino: 'needs_placement', quinn: 'new' }[studentKey] ?? 'enrolled';
        assert.equal(standing.status, expectedStatus);

        // Their timetable, as the schedule page reads it.
        assert.deepEqual(
          await everyRow(kid, '/schedules'),
          enrollment ? await everyRow(school.admin, '/schedules', { classId: enrollment.classId }) : [],
        );
      });

      it(`${name}: each lesson's teacher reads their marks and grades as they do`, async () => {
        const kid = school.students[studentKey];
        const { studentId } = kid;
        const assessmentLesson = new Map(db.assessments.map((a) => [a.id, a.classSubjectId]));
        const lessonIds = new Set([
          ...db.attendance.filter((row) => row.studentId === studentId).map((row) => row.classSubjectId),
          ...db.grades
            .filter((g) => g.studentId === studentId)
            .map((g) => assessmentLesson.get(g.assessmentId)),
        ]);
        for (const classSubjectId of lessonIds) {
          const owner = Object.values(school.teachers).find(
            (teacher) => teacher.teacherId === lessonById(classSubjectId).teacherId,
          );
          const theirs = await read(kid, '/attendance/summary', { studentId: 'me', classSubjectId });
          const teacherRow = (
            await read(owner, '/attendance/summary', { classSubjectId, groupBy: 'student' })
          ).find((row) => row.studentId === studentId);
          assert.deepEqual(
            theirs,
            teacherRow ? countsOf(teacherRow) : tally([]),
            `attendance of ${classSubjectId}`,
          );
          assert.deepEqual(
            await read(kid, '/attendance', { classSubjectId, limit: 100 }),
            await read(owner, '/attendance', { classSubjectId, studentId, limit: 100 }),
          );

          const summary = await read(kid, '/grades/summary', { studentId: 'me', classSubjectId });
          assert.deepEqual(summary, await read(owner, '/grades/summary', { classSubjectId, studentId }));
          const byStudent = (
            await read(owner, '/grades/summary', { classSubjectId, groupBy: 'student' })
          ).find((row) => row.studentId === studentId);
          assert.equal(
            byStudent?.percentage ?? null,
            summary[0]?.percentage ?? null,
            `grade of ${classSubjectId}`,
          );
          assert.deepEqual(
            await read(kid, '/grades', { classSubjectId, limit: 100 }),
            await read(owner, '/grades', { classSubjectId, studentId, limit: 100 }),
          );
        }
      });

      it(`${name}: every list holds only their own rows, and other students are refused`, async () => {
        const kid = school.students[studentKey];
        const { studentId } = kid;
        const classId = activeEnrollmentOf(studentId)?.classId ?? null;
        const classLessons = lessonIdsIn(new Set(classId ? [classId] : []));
        const expected = {
          '/attendance': db.attendance.filter((row) => row.studentId === studentId).map((row) => row.id),
          '/grades': db.grades.filter((row) => row.studentId === studentId).map((row) => row.id),
          '/enrollments': db.enrollments.filter((row) => row.studentId === studentId).map((row) => row.id),
          '/assessments': db.assessments.filter((a) => classLessons.has(a.classSubjectId)).map((a) => a.id),
          '/class-subjects': [...classLessons],
          '/schedules': db.schedules.filter((s) => classLessons.has(s.classSubjectId)).map((s) => s.id),
          '/announcements': ids(visibleAnnouncements(kid)),
        };
        for (const [list, expectedIds] of Object.entries(expected)) {
          sameIds(ids(await everyRow(kid, list)), expectedIds, `${name} ${list}`);
        }
        sameIds(ids(await everyRow(kid, '/classes', { visible: 'true' })), classId ? [classId] : []);

        const other = school.students[studentKey === 'ana' ? 'ben' : 'ana'];
        await refused(kid, 'get', '/students', 'role_not_allowed');
        await refused(kid, 'get', `/students/${other.studentId}`, 'student_not_visible');
        await refused(kid, 'get', '/attendance', 'student_not_self', {
          params: { studentId: other.studentId },
        });
        await refused(kid, 'get', '/grades/summary', 'student_not_self', {
          params: { studentId: other.studentId },
        });
        await refused(kid, 'get', '/enrollments', 'student_not_self', {
          params: { studentId: other.studentId },
        });
        await refused(kid, 'get', '/grades/summary', 'group_by_student_not_allowed', {
          params: { groupBy: 'student' },
        });
        await refused(kid, 'get', '/attendance/sheet', 'role_not_allowed', {
          params: { classSubjectId: school.lessons['rizal.math'].id, date: TODAY },
        });
        const otherClass = db.classes.find((klass) => klass.id !== classId);
        await refused(kid, 'get', '/assessments', 'class_not_visible', {
          params: { classId: otherClass.id },
        });
      });
    }

    it("Carla's Mathematics: her quarters in Rizal and in Bonifacio make one subject grade", async () => {
      const { carla } = school.students;
      const rows = await officeRead('/grades/summary', {
        studentId: carla.studentId,
        academicYear: YEAR,
        semester: 'sem1',
      });
      const rizal = rows.find((row) => row.classSubjectId === school.lessons['rizal.math'].id);
      const bonifacio = rows.find((row) => row.classSubjectId === school.lessons['bonifacio.math'].id);
      // Rizal's 2nd Quarter quiz came after she left, Bonifacio's 1st Quarter before she came.
      assert.deepEqual([rizal.quarters.term2, bonifacio.quarters.term1], [null, null]);
      const [math] = (await dashboardOf(carla)).gradeSummary.filter(
        (row) => row.subjectId === school.subjects.math.id,
      );
      assert.deepEqual(
        [math.className, math.classSubjectIds],
        ['Grade 7 - Bonifacio / Grade 7 - Rizal', [bonifacio.classSubjectId, rizal.classSubjectId]],
      );
      // A K-12 semester grade is the mean of its quarterly grades, a whole number rounded half up.
      assert.equal(math.percentage, Math.round((rizal.quarters.term1 + bonifacio.quarters.term2) / 2));
    });

    it('a blank counts 0 once the assessment is given: Values (on points) worked out from the tables', async () => {
      // Rounded to 2 decimals, half up, as utils/grading rounds.
      const round2 = (value) => Math.round(Number((value * 100).toPrecision(15))) / 100;
      const scoreOf = (assessment, studentId) =>
        db.grades.find((g) => g.assessmentId === assessment.id && g.studentId === studentId)?.score ?? 0;
      for (const lessonKey of ['rizal.values', 'mabini.values']) {
        const classSubjectId = school.lessons[lessonKey].id;
        const given = db.assessments.filter((a) => a.classSubjectId === classSubjectId && gradedCount(a) > 0);
        const rows = await officeRead('/grades/summary', { classSubjectId, groupBy: 'student' });
        sameIds(
          rows.map((row) => row.studentId),
          [...new Set(given.flatMap((a) => [...rosterOf(a)]))],
          `${lessonKey}: everyone on a roster`,
        );
        for (const row of rows) {
          // Each quarter: points over the given assessments the student was on the roster of, a blank as 0.
          const quarters = ['term1', 'term2', 'term3', 'term4']
            .map((term) => given.filter((a) => a.term === term && rosterOf(a).has(row.studentId)))
            .filter((counted) => counted.length > 0)
            .map((counted) =>
              round2(
                (counted.reduce((sum, a) => sum + scoreOf(a, row.studentId), 0) /
                  counted.reduce((sum, a) => sum + a.maxScore, 0)) *
                  100,
              ),
            );
          // The 1st Semester is the only one graded: the year's grade is its mean of the quarters.
          const expected = round2(quarters.reduce((sum, grade) => sum + grade, 0) / quarters.length);
          assert.equal(row.percentage, expected, `${lessonKey}, student ${row.studentId}`);
        }
      }
      // Ben handed in no reflection: his 2nd Quarter in Values is 0, not left out.
      const [benValues] = await officeRead('/grades/summary', {
        studentId: school.students.ben.studentId,
        classSubjectId: school.lessons['rizal.values'].id,
        academicYear: YEAR,
        semester: 'sem1',
      });
      assert.equal(benValues.quarters.term2, 0);
    });

    // Without an active enrollment the student dashboard still covers the school year: a student withdrawn
    // mid-year keeps both the year's marks and the year's grades, as the office and their own pages show them.
    it("keeps a student withdrawn mid-year's grades on the dashboard, as their attendance", async () => {
      const { dino } = school.students;
      const dashboard = await dashboardOf(dino);
      const yearRows = await officeRead('/grades/summary', {
        studentId: dino.studentId,
        academicYear: YEAR,
      });
      assert.ok(dashboard.attendanceSummary.total > 0 && yearRows.length > 0, 'marks and grades this year');
      sameIds(
        dashboard.gradeSummary.map((row) => row.subjectId),
        [...new Set(yearRows.map((row) => row.subjectId))],
        'the grade summary card',
      );
      assert.deepEqual(
        dashboard.recentGrades.map((grade) => grade.gradeId),
        ids(await read(dino, '/grades', { limit: 5 })),
        'the recent grades card',
      );
    });
  });

  describe('the pages of the menu and their badges', () => {
    const { dateFrom: monthFrom, dateTo: monthTo } = monthRange();
    const month = { dateFrom: monthFrom, dateTo: monthTo, limit: 100 };
    const week = { ...weekRange(), limit: 100 };
    const UNENROLLED_STUDENTS = { hasActiveEnrollment: 'false', isActive: 'true', limit: 1 };
    const PENDING_APPLICATIONS = { admissionStatus: 'pending', isActive: 'true', limit: 1 };
    const PENDING_ASSISTANT_REQUESTS = { status: 'pending', limit: 1 };
    const NEW_ANNOUNCEMENTS = { unread: 'true', limit: 1 };

    /** The shell of every page: the account, the bell and the "New" announcements count. */
    async function shell(who) {
      await read(who, '/auth/me');
      const { count } = await read(who, '/notifications/unread-count');
      const newAnnouncements = await totalOf(who, '/announcements', NEW_ANNOUNCEMENTS);
      await read(who, '/notifications', { limit: 15 }); // the bell's panel, once opened
      return { count, newAnnouncements };
    }

    /** The bell and the "New" badge = the lists behind them = the database. */
    async function assertSharedBadges(who, { count, newAnnouncements }) {
      const unreadNotes = db.notifications.filter((note) => note.userId === who.id && note.readAt === null);
      assert.equal(count, unreadNotes.length, `${who.label}: unread notifications`);
      assert.equal(count, await totalOf(who, '/notifications', { unread: 'true' }));
      assert.equal(newAnnouncements, unreadAnnouncements(who).length, `${who.label}: new announcements`);
      const cards = await everyRow(who, '/announcements');
      assert.equal(
        newAnnouncements,
        cards.filter((a) => !a.isRead && a.status === 'active' && a.author.id !== who.id).length,
        `${who.label}: the cards tagged New`,
      );
    }

    for (const role of ['admin', 'assistant']) {
      it(`${role}: every page of the office menu loads, and the badges = the lists = the database`, async () => {
        const who = school[role];
        const badges = await shell(who);
        await assertSharedBadges(who, badges);
        const unenrolled = await totalOf(who, '/students', UNENROLLED_STUDENTS);
        const applications = await totalOf(who, '/students', PENDING_APPLICATIONS);
        const assistantRequests = await totalOf(who, '/assistant-requests', PENDING_ASSISTANT_REQUESTS);

        await read(who, '/dashboard');
        if (role === 'admin') await read(who, '/users', { page: 1, limit: 20 });
        else await refused(who, 'get', '/users', 'role_not_allowed', { params: { page: 1, limit: 20 } });
        await read(who, '/students', { page: 1, limit: 20 });
        const classes = await read(who, '/classes', { limit: 100 });
        const admissions = await ok(who, 'get', '/students', {
          params: {
            page: 1,
            limit: 20,
            sortBy: 'createdAt',
            sortOrder: 'asc',
            admissionStatus: 'pending',
            isActive: 'true',
          },
        });
        const requests = await ok(who, 'get', '/assistant-requests', {
          params: { page: 1, limit: 20, status: 'pending' },
        });
        await read(who, '/teachers', { page: 1, limit: 20 });
        await read(who, '/subjects', { page: 1, limit: 20 });
        await read(who, '/classes', { page: 1, limit: 20 });
        // Attendance and Grades: a class picked, then each of its lessons.
        for (const klass of classes) {
          for (const lesson of await read(who, '/class-subjects', { classId: klass.id, limit: 100 })) {
            await read(who, `/class-subjects/${lesson.id}`);
            await read(who, '/attendance/sheet', { classSubjectId: lesson.id, date: TODAY });
            await read(who, '/assessments', {
              page: 1,
              limit: 20,
              sortBy: 'assessedOn',
              sortOrder: 'desc',
              classSubjectId: lesson.id,
            });
          }
        }
        await read(who, '/announcements', { page: 1, limit: 20 });
        await read(who, '/calendar-events', month);
        await read(who, '/activity', { page: 1, limit: 20 });
        // The office's search box, once two letters are typed.
        for (const path of ['/students', '/teachers', '/classes', '/subjects']) {
          await read(who, path, { search: 'Ra', limit: 5 });
        }

        const { counts } = await dashboardOf(who);
        assert.equal(unenrolled, counts.unenrolledStudents, 'Students badge = the dashboard tile');
        assert.equal(applications, admissions.meta.total, 'Admissions badge = the Admissions page');
        assert.equal(
          applications,
          await sqlValue(
            `SELECT COUNT(*) FROM admissions ad JOIN students s ON s.id = ad.student_id
               JOIN users u ON u.id = s.user_id WHERE ad.status = 'pending' AND u.is_active = 1`,
          ),
        );
        assert.equal(assistantRequests, requests.meta.total, 'Assistant requests badge = its page');
        assert.equal(
          assistantRequests,
          await sqlValue(
            `SELECT COUNT(*) FROM assistant_requests ar JOIN users u ON u.id = ar.user_id
              WHERE ar.status = 'pending' AND u.is_active = 1`,
          ),
        );
        assert.deepEqual([unenrolled, applications, assistantRequests], [2, 1, 1]);
      });
    }

    for (const teacherKey of Object.keys(TEACHERS)) {
      it(`teacher ${TEACHERS[teacherKey].lastName}: every page of the menu loads, and the badges = the database`, async () => {
        const who = school.teachers[teacherKey];
        await assertSharedBadges(who, await shell(who));
        await read(who, '/dashboard');
        await read(who, '/class-subjects', {
          academicYear: YEAR,
          limit: 100,
          sortBy: 'className',
          sortOrder: 'asc',
        });
        await read(who, '/classes', { academicYear: YEAR, limit: 100, homeroomTeacherId: 'me' });
        await read(who, '/schedules', { academicYear: YEAR, limit: 100, teacherId: 'me' });
        await read(who, '/calendar-events', week);
        // Attendance and Grades pick from the lessons of their classes.
        for (const lesson of await read(who, '/class-subjects', { limit: 100 })) {
          await read(who, `/class-subjects/${lesson.id}`);
          await read(who, '/attendance/sheet', { classSubjectId: lesson.id, date: TODAY });
          await read(who, '/assessments', {
            page: 1,
            limit: 20,
            sortBy: 'assessedOn',
            sortOrder: 'desc',
            classSubjectId: lesson.id,
          });
        }
        await read(who, '/announcements', { page: 1, limit: 20 });
        await read(who, '/classes', { visible: 'true', limit: 100 });
        await read(who, '/calendar-events', month);
        // The office badges are not theirs: nobody without a class is in their classes, the requests are the office's.
        assert.equal(await totalOf(who, '/students', UNENROLLED_STUDENTS), 0);
        await refused(who, 'get', '/assistant-requests', 'role_not_allowed', {
          params: PENDING_ASSISTANT_REQUESTS,
        });
      });
    }

    for (const studentKey of Object.keys(STUDENTS)) {
      it(`student ${STUDENTS[studentKey].firstName}: every page of the menu loads, and the badges = the database`, async () => {
        const who = school.students[studentKey];
        await assertSharedBadges(who, await shell(who));
        const me = await read(who, '/auth/me');
        const enrolled = me.currentEnrollment !== null;
        const dashboard = await read(who, '/dashboard');
        if (!dashboard.currentEnrollment) await read(who, '/enrollments/next-class');
        if (enrolled) {
          await read(who, `/classes/${me.currentEnrollment.classId}`);
          await read(who, '/class-subjects', { limit: 100, sortBy: 'subjectName', sortOrder: 'asc' });
          await read(who, '/schedules', { limit: 100 });
          await read(who, '/calendar-events', week);
        } else {
          await read(who, '/enrollments/next-class');
        }
        // Attendance: the school year of their class (or the last one), from August 1 to today.
        await read(who, '/enrollments', {
          studentId: 'me',
          sortBy: 'enrolledOn',
          sortOrder: 'asc',
          limit: 100,
        });
        const range = { dateFrom: YEAR_START, dateTo: TODAY };
        await read(who, '/attendance', { page: 1, limit: 20, ...range });
        await read(who, '/attendance/summary', { studentId: 'me', ...range, groupBy: 'classSubject' });
        const overall = await read(who, '/attendance/summary', { studentId: 'me', ...range });
        if (overall.total > 0)
          await read(who, '/attendance/summary', { studentId: 'me', ...range, groupBy: 'week' });
        // Grades: this semester of that school year.
        await read(who, '/grades', {
          academicYear: YEAR,
          semester: 'sem1',
          sortBy: 'assessedOn',
          sortOrder: 'desc',
          page: 1,
          limit: 100,
        });
        await read(who, '/grades/summary', {
          studentId: 'me',
          academicYear: YEAR,
          semester: 'sem1',
          groupBy: 'classSubject',
        });
        if (me.currentEnrollment?.academicYear === YEAR) {
          await read(who, '/assessments', {
            semester: 'sem1',
            dateFrom: TODAY,
            sortBy: 'assessedOn',
            sortOrder: 'asc',
            limit: 100,
          });
        }
        await read(who, '/announcements', { page: 1, limit: 10 });
        await read(who, '/calendar-events', month);
      });
    }
  });

  it('answered no request of the whole run with a server error', (t) => {
    t.diagnostic(`${responses.length} requests sent`);
    assert.ok(responses.length > 1000, `${responses.length} requests checked`);
    assert.deepEqual(
      responses.filter((response) => response.status >= 500),
      [],
    );
  });
});
