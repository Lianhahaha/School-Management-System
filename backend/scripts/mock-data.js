/**
 * mock-data.js — a complete, clearly tagged mock school for manual testing, and its removal.
 *
 *   node --env-file=.env.cloud scripts/mock-data.js add      create it (refused while mock data exists)
 *   node --env-file=.env.cloud scripts/mock-data.js status   count what is there
 *   node --env-file=.env.cloud scripts/mock-data.js remove   delete every mock row and every mock sign-in
 *
 * (Use `--env-file=.env` for the local database.) Everything mock is tagged, so `remove` touches nothing else:
 *   accounts            e-mail ending in @mock.skole.test (Firebase sign-ins with one shared password)
 *   classes             name ending in "(Mock)"
 *   subjects            code starting with "MK-"
 *   announcements,      title starting with "[Mock]" (announcements also by a mock author or for a mock class)
 *   calendar entries
 * `remove` also deletes what was done to mock records while testing: grades, marks, enrollments, read marks,
 * notifications, and the activity entries by a mock account or naming a mock person, class or subject.
 *
 * What `add` builds, so every screen has something to show:
 *   1 admin, 6 teachers (one subject each), 32 students; this year three classes of 10 with a full weekly
 *   timetable, marks on every school day since August (today's lessons left to mark), K-12 graded subjects with
 *   1st-semester written work, projects and quarterly exams, a quiz waiting to be graded and upcoming
 *   midterms; last year's class with grades in all
 *   three periods (for the school-year picker); next year's empty class (to try End of school year); one
 *   transfer, one student without a class, one deactivated student; announcements (current, scheduled,
 *   expired, class-only), calendar holidays and events, and unread notifications.
 */
import { closePool, query, run, withTransaction } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { assertFirebaseReady, firebase } from '../src/config/firebase.js';
import { createUserAccount } from '../src/modules/users/users.service.js';
import {
  academicYearStart,
  addDaysYmd,
  currentAcademicYear,
  isoWeekdayOf,
  todayYmd,
} from '../src/utils/dates.js';

const DOMAIN = 'mock.skole.test';
const PASSWORD = process.env.MOCK_PASSWORD || 'MockPass123!';

/* ---------------------------------------------------------------- the cast */

const ADMIN = { key: 'admin', firstName: 'Andrea', lastName: 'Villanueva' };

/** One teacher per subject; the first three are homeroom teachers of this year's classes. */
const TEACHERS = [
  { key: 'dizon', firstName: 'Ramon', lastName: 'Dizon', department: 'Mathematics', subject: 'MK-MATH' },
  { key: 'mercado', firstName: 'Liza', lastName: 'Mercado', department: 'Languages', subject: 'MK-ENG' },
  { key: 'navarro', firstName: 'Paolo', lastName: 'Navarro', department: 'Sciences', subject: 'MK-SCI' },
  { key: 'bautista', firstName: 'Teresa', lastName: 'Bautista', department: 'Languages', subject: 'MK-FIL' },
  {
    key: 'santiago',
    firstName: 'Joel',
    lastName: 'Santiago',
    department: 'Social Studies',
    subject: 'MK-AP',
  },
  { key: 'reyes', firstName: 'Carmela', lastName: 'Reyes', department: 'MAPEH', subject: 'MK-MAPEH' },
];

const SUBJECTS = [
  {
    code: 'MK-MATH',
    name: 'Mathematics (Mock)',
    description: 'Algebra, geometry and statistics.',
    group: 'math_science',
  },
  {
    code: 'MK-ENG',
    name: 'English (Mock)',
    description: 'Reading, writing and speaking.',
    group: 'languages',
  },
  {
    code: 'MK-SCI',
    name: 'Science (Mock)',
    description: 'Biology, chemistry and physics.',
    group: 'math_science',
  },
  { code: 'MK-FIL', name: 'Filipino (Mock)', description: 'Wika at panitikan.', group: 'languages' },
  {
    code: 'MK-AP',
    name: 'Araling Panlipunan (Mock)',
    description: 'History and civics.',
    group: 'languages',
  },
  { code: 'MK-MAPEH', name: 'MAPEH (Mock)', description: 'Music, arts, PE and health.', group: 'mapeh' },
];

const STUDENT_NAMES = [
  ['Juan', 'Dela Cruz', 'male'],
  ['Maria', 'Santos', 'female'],
  ['Jose', 'Garcia', 'male'],
  ['Angela', 'Ramos', 'female'],
  ['Miguel', 'Torres', 'male'],
  ['Sofia', 'Aquino', 'female'],
  ['Carlo', 'Mendoza', 'male'],
  ['Bea', 'Castillo', 'female'],
  ['Rafael', 'Flores', 'male'],
  ['Isabel', 'Lopez', 'female'],
  ['Gabriel', 'Morales', 'male'],
  ['Camille', 'Rivera', 'female'],
  ['Daniel', 'Gonzales', 'male'],
  ['Patricia', 'Cruz', 'female'],
  ['Marco', 'Fernandez', 'male'],
  ['Andrea', 'Pascual', 'female'],
  ['Luis', 'Salazar', 'male'],
  ['Kristine', 'Domingo', 'female'],
  ['Enrique', 'Velasco', 'male'],
  ['Nicole', 'Soriano', 'female'],
  ['Paolo', 'Manalo', 'male'],
  ['Jasmine', 'Ocampo', 'female'],
  ['Adrian', 'Aguilar', 'male'],
  ['Trisha', 'Valdez', 'female'],
  ['Kevin', 'Robles', 'male'],
  ['Erika', 'Tolentino', 'female'],
  ['Francis', 'Lim', 'male'],
  ['Danica', 'Ignacio', 'female'],
  ['Jerome', 'Padilla', 'male'],
  ['Hannah', 'Mariano', 'female'],
  ['Vincent', 'Estrada', 'male'],
  ['Lea', 'Panganiban', 'female'],
];

/* ---------------------------------------------------------------- calendar and helpers */

const YEAR = currentAcademicYear();
const FIRST = Number(YEAR.slice(0, 4));
const PAST_YEAR = `${FIRST - 1}-${FIRST}`;
const NEXT_YEAR = `${FIRST + 1}-${FIRST + 2}`;
const TODAY = todayYmd();
const YEAR_START = academicYearStart(YEAR);

/** Deterministic pseudo-random numbers (mulberry32), so every run builds the same school. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = random(20261008);
const pick = (items) => items[Math.floor(rand() * items.length)];

/** The first weekday on or after `ymd`. */
const weekdayFrom = (ymd) => {
  let day = ymd;
  while (isoWeekdayOf(day) > 5) day = addDaysYmd(day, 1);
  return day;
};
/** Every Monday-to-Friday date from `from` to `to`, both included. */
function schoolDays(from, to) {
  const days = [];
  for (let day = from; day <= to; day = addDaysYmd(day, 1)) if (isoWeekdayOf(day) <= 5) days.push(day);
  return days;
}
const email = (key) => `${key}@${DOMAIN}`;
/** `(?)`-safe id list: an empty list matches nothing instead of producing `IN ()`. */
const ids = (list) => (list.length ? list : [0]);

/** Inserts rows in batches of 500; `rows` are arrays in `columns` order. */
async function insertMany(table, columns, rows, conn) {
  for (let start = 0; start < rows.length; start += 500) {
    await run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`,
      [rows.slice(start, start + 500)],
      conn,
    );
  }
}

/** Five 50-minute periods a day. */
const PERIODS = [
  ['08:00', '08:50'],
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['11:00', '11:50'],
  ['13:00', '13:50'],
];
/**
 * Subject index of a period: the three classes of a year are shifted by two, so at any hour each class has a
 * different subject and therefore a different teacher (no timetable clash).
 */
const subjectAt = (classIndex, day, period) => (period + day + classIndex * 2) % SUBJECTS.length;

/* ---------------------------------------------------------------- add */

async function existingMockUsers() {
  return query('SELECT id, email, firebase_uid FROM users WHERE email LIKE ?', [`%@${DOMAIN}`]);
}

async function createAccounts() {
  const account = (role, key, extra) =>
    createUserAccount(
      {
        email: email(key),
        password: PASSWORD,
        role,
        firstName: extra.firstName,
        lastName: extra.lastName,
        ...extra.rest,
      },
      { trusted: true },
    );

  const admin = await account('admin', ADMIN.key, ADMIN);
  const teachers = [];
  for (const teacher of TEACHERS) {
    const created = await account('teacher', teacher.key, {
      ...teacher,
      rest: {
        phone: `+63 917 555 ${String(1000 + teachers.length).slice(-4)}`,
        profile: { department: teacher.department, hireDate: `${FIRST - 4}-06-15`, qualification: 'LPT' },
      },
    });
    teachers.push({ ...teacher, userId: created.id, teacherId: created.teacherId ?? created.profile.id });
  }
  const students = [];
  for (const [index, [firstName, lastName, gender]] of STUDENT_NAMES.entries()) {
    const key = `${firstName}.${lastName}`.toLowerCase().replaceAll(' ', '');
    const created = await account('student', key, {
      firstName,
      lastName,
      rest: {
        phone: `+63 918 555 ${String(2000 + index).slice(-4)}`,
        profile: {
          gender,
          dateOfBirth: `${FIRST - 16}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
          address: `${100 + index} Mabini Street, Quezon City`,
          guardianName: `${pick(['Rosa', 'Eduardo', 'Lourdes', 'Ricardo', 'Corazon'])} ${lastName}`,
          guardianPhone: `+63 919 555 ${String(3000 + index).slice(-4)}`,
          admissionDate: `${FIRST - 1}-06-01`,
        },
      },
    });
    students.push({
      key,
      firstName,
      lastName,
      userId: created.id,
      studentId: created.studentId ?? created.profile.id,
      firebaseUid: created.firebaseUid,
    });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return { admin, teachers, students };
}

async function buildSchool({ admin, teachers, students }, conn) {
  const now = new Date();
  const ts = (ymd, hour = 8) => `${ymd} ${String(hour).padStart(2, '0')}:00:00`;

  // Subjects, each graded by K-12 components with its DepEd subject group.
  const subjectIds = {};
  for (const subject of SUBJECTS) {
    const result = await run(
      'INSERT INTO subjects (code, name, description, grading_group) VALUES (?, ?, ?, ?)',
      [subject.code, subject.name, subject.description, subject.group],
      conn,
    );
    subjectIds[subject.code] = result.insertId;
  }

  // Classes: three this year, last year's 9-A, next year's 11-A (empty, for End of school year).
  const addClass = async (name, gradeLevel, academicYear, homeroom) =>
    (
      await run(
        'INSERT INTO classes (name, grade_level, academic_year, homeroom_teacher_id) VALUES (?, ?, ?, ?)',
        [name, gradeLevel, academicYear, homeroom?.teacherId ?? null],
        conn,
      )
    ).insertId;
  const current = [
    {
      id: await addClass('Grade 10 - A (Mock)', 10, YEAR, teachers[0]),
      name: 'Grade 10 - A (Mock)',
      students: students.slice(0, 10),
    },
    {
      id: await addClass('Grade 10 - B (Mock)', 10, YEAR, teachers[1]),
      name: 'Grade 10 - B (Mock)',
      students: students.slice(10, 20),
    },
    {
      id: await addClass('Grade 11 - A (Mock)', 11, YEAR, teachers[2]),
      name: 'Grade 11 - A (Mock)',
      students: students.slice(20, 30),
    },
  ];
  const past = {
    id: await addClass('Grade 9 - A (Mock)', 9, PAST_YEAR, teachers[3]),
    students: students.slice(0, 10),
  };
  await addClass('Grade 11 - A (Mock)', 11, NEXT_YEAR, null);

  // Class-subjects: every subject in every class, taught by its subject teacher.
  const teacherOf = (code) => teachers.find((teacher) => teacher.subject === code);
  const addClassSubjects = async (classId) => {
    const list = [];
    for (const subject of SUBJECTS) {
      const teacher = teacherOf(subject.code);
      const result = await run(
        'INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?)',
        [classId, subjectIds[subject.code], teacher.teacherId],
        conn,
      );
      list.push({ id: result.insertId, code: subject.code, markerId: teacher.userId });
    }
    return list;
  };
  for (const klass of current) klass.classSubjects = await addClassSubjects(klass.id);
  past.classSubjects = await addClassSubjects(past.id);

  // Timetables: five periods a day, Monday to Friday.
  const timetable = (klass, classIndex, room) => {
    const rows = [];
    for (let day = 1; day <= 5; day += 1) {
      PERIODS.forEach(([start, end], period) => {
        rows.push([klass.classSubjects[subjectAt(classIndex, day, period)].id, day, start, end, room]);
      });
    }
    return rows;
  };
  await insertMany(
    'schedules',
    ['class_subject_id', 'day_of_week', 'start_time', 'end_time', 'room'],
    [
      ...timetable(current[0], 0, 'Room 201'),
      ...timetable(current[1], 1, 'Room 202'),
      ...timetable(current[2], 2, 'Room 301'),
      ...timetable(past, 0, 'Room 105'),
    ],
    conn,
  );

  // Enrollments. Last year: 9-A (completed). This year: 10 per class; student 11 moved from 10-B to 10-A on
  // the fifth Monday; student 31 has no class; student 32 is deactivated.
  const transferDay = weekdayFrom(addDaysYmd(YEAR_START, 35));
  const enrollmentRows = [];
  for (const student of past.students) {
    enrollmentRows.push([student.studentId, past.id, 'completed', academicYearStart(PAST_YEAR), YEAR_START]);
  }
  const transferred = students[10];
  current.forEach((klass) => {
    for (const student of klass.students) {
      if (student === transferred) continue;
      enrollmentRows.push([student.studentId, klass.id, 'active', YEAR_START, null]);
    }
  });
  enrollmentRows.push([transferred.studentId, current[1].id, 'transferred', YEAR_START, transferDay]);
  enrollmentRows.push([transferred.studentId, current[0].id, 'active', transferDay, null]);
  await insertMany(
    'enrollments',
    ['student_id', 'class_id', 'status', 'enrolled_on', 'left_on'],
    enrollmentRows,
    conn,
  );
  /** Who was in `klass` on `day` (the transfer included). */
  const rosterOn = (klass, day) => {
    const members = klass.students.filter((student) => student !== transferred);
    if (klass === current[0] && day >= transferDay) members.push(transferred);
    if (klass === current[1] && day < transferDay) members.push(transferred);
    return members;
  };
  const deactivated = students[31];
  await run('UPDATE users SET is_active = 0 WHERE id = ?', [deactivated.userId], conn);

  // Student traits: most attend and score well; a few need attention (the at-risk lists).
  const absentRate = new Map(
    students.map((student, index) => [student.studentId, [3, 14, 25].includes(index) ? 0.28 : 0.04]),
  );
  const ability = new Map(
    students.map((student, index) => [
      student.studentId,
      [6, 17, 25].includes(index) ? 0.6 : 0.72 + rand() * 0.25,
    ]),
  );

  // Calendar: a past holiday (no marks that day), an event this month, a holiday and a week of exams ahead.
  const pastHoliday = weekdayFrom(addDaysYmd(YEAR_START, 19));
  const examWeek = weekdayFrom(addDaysYmd(TODAY, 7));
  await insertMany(
    'calendar_events',
    ['title', 'description', 'type', 'starts_on', 'ends_on'],
    [
      ['[Mock] National holiday', 'No classes.', 'holiday', pastHoliday, pastHoliday],
      [
        '[Mock] Foundation Day',
        'Program at the covered court, 9:00.',
        'event',
        addDaysYmd(TODAY, 3),
        addDaysYmd(TODAY, 3),
      ],
      [
        '[Mock] Midterm examinations',
        'Bring two pencils and your exam permit.',
        'event',
        examWeek,
        addDaysYmd(examWeek, 2),
      ],
      [
        '[Mock] Teachers’ in-service day',
        'No classes for students.',
        'holiday',
        addDaysYmd(examWeek, 10),
        addDaysYmd(examWeek, 10),
      ],
    ],
    conn,
  );

  // Attendance: every lesson of every school day since the year began, up to yesterday (today's are left to
  // mark); last year, four weeks in September.
  const statuses = (student) => {
    const roll = rand();
    const absent = absentRate.get(student.studentId);
    if (roll < absent) return 'absent';
    if (roll < absent + 0.05) return 'late';
    if (roll < absent + 0.07) return 'excused';
    return 'present';
  };
  const attendanceRows = [];
  const markLessons = (klass, classIndex, days) => {
    for (const day of days) {
      const weekday = isoWeekdayOf(day);
      for (let period = 0; period < PERIODS.length; period += 1) {
        const classSubject = klass.classSubjects[subjectAt(classIndex, weekday, period)];
        for (const student of rosterOn(klass, day)) {
          const status = statuses(student);
          const remarks =
            status === 'excused'
              ? 'Medical certificate'
              : status === 'late'
                ? 'Arrived 10 minutes late'
                : null;
          attendanceRows.push([
            student.studentId,
            classSubject.id,
            day,
            status,
            classSubject.markerId,
            remarks,
          ]);
        }
      }
    }
  };
  const yesterday = addDaysYmd(TODAY, -1);
  const thisYearDays = schoolDays(weekdayFrom(YEAR_START), yesterday).filter((day) => day !== pastHoliday);
  current.forEach((klass, index) => markLessons(klass, index, thisYearDays));
  const pastSeptember = weekdayFrom(`${FIRST - 1}-09-01`);
  for (const day of schoolDays(pastSeptember, addDaysYmd(pastSeptember, 25))) {
    const weekday = isoWeekdayOf(day);
    for (let period = 0; period < PERIODS.length; period += 1) {
      const classSubject = past.classSubjects[subjectAt(0, weekday, period)];
      for (const student of past.students) {
        attendanceRows.push([
          student.studentId,
          classSubject.id,
          day,
          statuses(student),
          classSubject.markerId,
          null,
        ]);
      }
    }
  }
  // Two attendance rows can coincide when a subject repeats in a day (unique per student, lesson and date).
  const uniqueAttendance = [
    ...new Map(attendanceRows.map((row) => [`${row[0]}|${row[1]}|${row[2]}`, row])).values(),
  ];
  await insertMany(
    'attendance',
    ['student_id', 'class_subject_id', 'attendance_date', 'status', 'marked_by', 'remarks'],
    uniqueAttendance,
    conn,
  );

  // Assessments and grades.
  const gradeRows = [];
  const addAssessment = async (classSubject, title, type, term, maxScore, assessedOn) =>
    (
      await run(
        'INSERT INTO assessments (class_subject_id, title, type, term, max_score, assessed_on) VALUES (?, ?, ?, ?, ?, ?)',
        [classSubject.id, title, type, term, maxScore, assessedOn],
        conn,
      )
    ).insertId;
  const grade = (assessmentId, classSubject, members, maxScore) => {
    for (const student of members) {
      const share = Math.min(1, Math.max(0.3, ability.get(student.studentId) + (rand() - 0.5) * 0.2));
      const score = Math.round(maxScore * share * 2) / 2;
      gradeRows.push([
        assessmentId,
        student.studentId,
        score,
        share < 0.6 ? 'Needs follow-up' : null,
        classSubject.markerId,
      ]);
    }
  };
  // This year, 1st Semester: graded written work (quizzes, a test, an assignment), a performance task and the
  // quarterly exam; a quiz still to grade; an upcoming midterm.
  const plan = [
    ['Quiz 1', 'quiz', 20, 17],
    ['Quiz 2', 'quiz', 20, 31],
    ['Group project', 'project', 50, 38],
    ['Unit test', 'test', 50, 45],
    ['Reflection paper', 'assignment', 10, 52],
    ['1st quarterly exam', 'exam', 50, 58],
  ];
  for (const [classIndex, klass] of current.entries()) {
    for (const [subjectIndex, classSubject] of klass.classSubjects.entries()) {
      for (const [title, type, maxScore, offset] of plan) {
        const day = weekdayFrom(addDaysYmd(YEAR_START, offset + subjectIndex + classIndex));
        if (day >= TODAY) continue;
        const id = await addAssessment(classSubject, title, type, 'term1', maxScore, day);
        grade(id, classSubject, rosterOn(klass, day), maxScore);
      }
      if (subjectIndex % 2 === 0) {
        await addAssessment(
          classSubject,
          'Quiz 3',
          'quiz',
          'term1',
          20,
          weekdayFrom(addDaysYmd(TODAY, -3 - subjectIndex)),
        );
      }
      await addAssessment(
        classSubject,
        'Midterm exam',
        'exam',
        'term1',
        100,
        weekdayFrom(addDaysYmd(examWeek, subjectIndex % 3)),
      );
    }
  }
  // Last year: a quiz, a test, a project and an exam in each of the 1st Semester, 2nd Semester and Summer.
  const pastTerms = [
    ['term1', `${FIRST - 1}-09-15`],
    ['term2', `${FIRST}-01-20`],
    ['term3', `${FIRST}-04-20`],
  ];
  for (const [subjectIndex, classSubject] of past.classSubjects.entries()) {
    for (const [term, start] of pastTerms) {
      for (const [index, [title, type, maxScore]] of [
        ['Quiz', 'quiz', 20],
        ['Long test', 'test', 50],
        ['Project', 'project', 50],
        ['Exam', 'exam', 100],
      ].entries()) {
        const day = weekdayFrom(addDaysYmd(start, index * 14 + subjectIndex));
        const id = await addAssessment(classSubject, title, type, term, maxScore, day);
        grade(id, classSubject, past.students, maxScore);
      }
    }
  }
  await insertMany(
    'grades',
    ['assessment_id', 'student_id', 'score', 'remarks', 'graded_by'],
    gradeRows,
    conn,
  );

  // Announcements: current, class-only, teachers-only, scheduled and expired ones.
  const daysFromNow = (days) => {
    const date = new Date(now.getTime() + days * 86_400_000);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  await insertMany(
    'announcements',
    ['author_id', 'title', 'body', 'audience', 'class_id', 'published_at', 'expires_at'],
    [
      [
        admin.id,
        '[Mock] Welcome to the new school year',
        'Classes run Monday to Friday, 8:00 to 14:00. Check your timetable on your dashboard.',
        'all',
        null,
        ts(YEAR_START),
        null,
      ],
      [
        admin.id,
        '[Mock] Parent-teacher conference',
        'Parents are invited on Saturday, 9:00 to 12:00, in each homeroom.',
        'students',
        null,
        daysFromNow(-2),
        daysFromNow(10),
      ],
      [
        admin.id,
        '[Mock] Grade submission deadline',
        'Please finish encoding 1st Semester quiz grades by Friday.',
        'teachers',
        null,
        daysFromNow(-1),
        null,
      ],
      [
        teachers[2].userId,
        '[Mock] Science fair projects',
        'Groups of four. Submit your proposal on the class page by next week.',
        'students',
        current[0].id,
        daysFromNow(-3),
        null,
      ],
      [
        admin.id,
        '[Mock] Midterm schedule posted',
        'The midterm examination schedule is on the school calendar.',
        'all',
        null,
        daysFromNow(2),
        null,
      ],
      [
        admin.id,
        '[Mock] Enrollment week',
        'Enrollment for transferees has closed.',
        'all',
        null,
        ts(addDaysYmd(YEAR_START, -10)),
        ts(addDaysYmd(YEAR_START, 5)),
      ],
    ],
    conn,
  );

  // Notifications: a few unread ones for students and teachers, one already read.
  const notifications = [];
  for (const student of students.slice(0, 30)) {
    notifications.push([
      student.userId,
      'grade',
      'New grade in Science (Mock)',
      'Unit test',
      '/student/grades',
      null,
    ]);
  }
  for (const index of [3, 14, 25]) {
    notifications.push([
      students[index].userId,
      'attendance',
      'Marked absent in Mathematics (Mock)',
      'Yesterday',
      '/student/attendance',
      null,
    ]);
  }
  notifications.push([
    transferred.userId,
    'enrollment',
    'You moved to Grade 10 - A (Mock)',
    'From Grade 10 - B (Mock)',
    '/student/class',
    ts(transferDay),
  ]);
  for (const teacher of teachers) {
    notifications.push([
      teacher.userId,
      'teaching',
      'You teach a subject in Grade 10 - A (Mock)',
      YEAR,
      '/teacher/classes',
      null,
    ]);
  }
  notifications.push([
    admin.id,
    'signup',
    `New student sign-up: ${students[30].firstName} ${students[30].lastName}`,
    `${email(students[30].key)} · needs a class`,
    `/admin/students/${students[30].studentId}`,
    null,
  ]);
  await insertMany(
    'notifications',
    ['user_id', 'type', 'title', 'body', 'link', 'read_at'],
    notifications,
    conn,
  );

  return {
    attendance: uniqueAttendance.length,
    grades: gradeRows.length,
    deactivated,
  };
}

async function add() {
  assertFirebaseReady();
  if ((await existingMockUsers()).length) {
    throw new Error('Mock data is already there. Run `remove` first, or `status` to see it.');
  }
  console.log(
    `Adding the mock school to ${env.DB_NAME} on ${env.DB_HOST} (Firebase project ${firebase.projectId})`,
  );
  console.log('Accounts (Firebase + MySQL):');
  const cast = await createAccounts();
  console.log('School data:');
  const totals = await withTransaction((conn) => buildSchool(cast, conn));
  await firebase.updateUser(totals.deactivated.firebaseUid, { disabled: true });
  console.log(
    `✔ Mock school added: 39 accounts, 5 classes, 6 subjects, ${totals.attendance} attendance marks, ${totals.grades} grades.`,
  );
  console.log(`  Sign in with any account below, password: ${PASSWORD}`);
  console.log(`    admin    ${email(ADMIN.key)}`);
  console.log(`    teacher  ${email(TEACHERS[0].key)}  (homeroom Grade 10 - A, teaches Mathematics)`);
  console.log(`    student  ${email('juan.delacruz')}  (Grade 10 - A, also has last year's grades)`);
  console.log(
    `  Every account: \`node --env-file=<file> scripts/mock-data.js status\`. Remove it all with \`remove\`.`,
  );
}

/* ---------------------------------------------------------------- status and remove */

/** The ids of everything tagged mock. */
async function findMock(conn) {
  const users = await query(
    'SELECT id, firebase_uid, first_name, last_name FROM users WHERE email LIKE ?',
    [`%@${DOMAIN}`],
    conn,
  );
  const userIds = users.map((row) => row.id);
  const column = async (sql, params) => (await query(sql, params, conn)).map((row) => row.id);
  const studentIds = await column('SELECT id FROM students WHERE user_id IN (?)', [ids(userIds)]);
  const teacherIds = await column('SELECT id FROM teachers WHERE user_id IN (?)', [ids(userIds)]);
  const classIds = await column("SELECT id FROM classes WHERE name LIKE '%(Mock)'", []);
  const subjectIds = await column("SELECT id FROM subjects WHERE code LIKE 'MK-%'", []);
  const classSubjectIds = await column(
    'SELECT id FROM class_subjects WHERE class_id IN (?) OR subject_id IN (?) OR teacher_id IN (?)',
    [ids(classIds), ids(subjectIds), ids(teacherIds)],
  );
  // Mock assessments: in mock lessons, or "[Mock]" ones added to a real class by `attach`.
  const assessmentIds = await column(
    "SELECT id FROM assessments WHERE class_subject_id IN (?) OR title LIKE '[Mock]%'",
    [ids(classSubjectIds)],
  );
  const announcementIds = await column(
    "SELECT id FROM announcements WHERE author_id IN (?) OR class_id IN (?) OR title LIKE '[Mock]%'",
    [ids(userIds), ids(classIds)],
  );
  return {
    users,
    userIds,
    studentIds,
    teacherIds,
    classIds,
    subjectIds,
    classSubjectIds,
    assessmentIds,
    announcementIds,
  };
}

async function status() {
  const mock = await findMock();
  const count = async (sql, params) => (await query(sql, params))[0].n;
  console.log(`Mock data in ${env.DB_NAME} on ${env.DB_HOST}:`);
  console.log(
    `  accounts ${mock.userIds.length}, classes ${mock.classIds.length}, subjects ${mock.subjectIds.length}, announcements ${mock.announcementIds.length}`,
  );
  console.log(
    `  attendance marks ${await count('SELECT COUNT(*) AS n FROM attendance WHERE class_subject_id IN (?) OR student_id IN (?)', [ids(mock.classSubjectIds), ids(mock.studentIds)])}`,
  );
  console.log(
    `  grades ${await count('SELECT COUNT(*) AS n FROM grades WHERE assessment_id IN (?) OR student_id IN (?)', [ids(mock.assessmentIds), ids(mock.studentIds)])}`,
  );
  if (mock.users.length) {
    const accounts = await query('SELECT email, role FROM users WHERE id IN (?) ORDER BY role, email', [
      mock.userIds,
    ]);
    console.log(`  sign-ins (password ${PASSWORD} unless changed):`);
    for (const row of accounts) console.log(`    ${row.role.padEnd(7)} ${row.email}`);
  }
}

async function remove() {
  assertFirebaseReady();
  console.log(`Removing the mock school from ${env.DB_NAME} on ${env.DB_HOST}`);
  const uids = await withTransaction(async (conn) => {
    const m = await findMock(conn);
    const names = m.users.map((row) => `${row.firstName} ${row.lastName}`);
    const del = (sql, params) => run(sql, params, conn);
    await del('DELETE FROM grades WHERE assessment_id IN (?) OR student_id IN (?) OR graded_by IN (?)', [
      ids(m.assessmentIds),
      ids(m.studentIds),
      ids(m.userIds),
    ]);
    await del(
      'DELETE FROM attendance WHERE class_subject_id IN (?) OR student_id IN (?) OR marked_by IN (?)',
      [ids(m.classSubjectIds), ids(m.studentIds), ids(m.userIds)],
    );
    await del('DELETE FROM assessments WHERE id IN (?)', [ids(m.assessmentIds)]);
    await del('DELETE FROM schedules WHERE class_subject_id IN (?)', [ids(m.classSubjectIds)]);
    await del('DELETE FROM class_subjects WHERE id IN (?)', [ids(m.classSubjectIds)]);
    await del('DELETE FROM enrollments WHERE student_id IN (?) OR class_id IN (?)', [
      ids(m.studentIds),
      ids(m.classIds),
    ]);
    await del('DELETE FROM subject_grade_weights WHERE subject_id IN (?)', [ids(m.subjectIds)]);
    await del('DELETE FROM announcement_reads WHERE user_id IN (?) OR announcement_id IN (?)', [
      ids(m.userIds),
      ids(m.announcementIds),
    ]);
    await del('DELETE FROM announcements WHERE id IN (?)', [ids(m.announcementIds)]);
    await del("DELETE FROM calendar_events WHERE title LIKE '[Mock]%'", []);
    await del('DELETE FROM notifications WHERE user_id IN (?)', [ids(m.userIds)]);
    // Activity: by a mock account, or naming a mock person, class or subject.
    const mentions = [
      "summary LIKE '%(Mock)%'",
      "summary LIKE '%[Mock]%'",
      `summary LIKE '%@${DOMAIN}%'`,
      ...names.map(() => 'summary LIKE ?'),
    ];
    await del(`DELETE FROM activity_log WHERE actor_id IN (?) OR ${mentions.join(' OR ')}`, [
      ids(m.userIds),
      ...names.map((name) => `%${name}%`),
    ]);
    // A real class whose homeroom teacher was a mock teacher keeps its class, without a homeroom teacher.
    await del(
      'UPDATE classes SET homeroom_teacher_id = NULL WHERE homeroom_teacher_id IN (?) AND id NOT IN (?)',
      [ids(m.teacherIds), ids(m.classIds)],
    );
    await del('DELETE FROM classes WHERE id IN (?)', [ids(m.classIds)]);
    await del('DELETE FROM subjects WHERE id IN (?)', [ids(m.subjectIds)]);
    // An application row exists only for a mock student who signed up through /register while testing.
    await del('DELETE FROM admissions WHERE student_id IN (?)', [ids(m.studentIds)]);
    await del('DELETE FROM students WHERE id IN (?)', [ids(m.studentIds)]);
    await del('DELETE FROM teachers WHERE id IN (?)', [ids(m.teacherIds)]);
    await del('DELETE FROM users WHERE id IN (?)', [ids(m.userIds)]);
    console.log(
      `  database: ${m.userIds.length} accounts, ${m.classIds.length} classes, ${m.subjectIds.length} subjects and everything on them`,
    );
    return m.users.map((row) => row.firebaseUid);
  });
  // Sign-ins last, once the rows are gone; also any mock sign-in left by an interrupted `add`.
  const known = new Set(uids);
  const emails = [
    ADMIN.key,
    ...TEACHERS.map((t) => t.key),
    ...STUDENT_NAMES.map(([f, l]) => `${f}.${l}`.toLowerCase().replaceAll(' ', '')),
  ];
  for (const key of emails) {
    try {
      known.add((await firebase.getUserByEmail(email(key))).uid);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
  }
  for (const uid of known) {
    try {
      await firebase.deleteUser(uid);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
  }
  console.log(`  Firebase: ${known.size} sign-ins deleted`);
  console.log('✔ Mock school removed.');
}

/**
 * Gives an existing (real) student mock grades, so their own sign-in has something to show: a completed place
 * in last year's mock class with grades in all three periods, and "[Mock]" 1st-semester assessments with
 * grades in their current class. `remove` deletes all of it and leaves the account and its class as they were.
 */
async function attach() {
  const target = process.argv[3];
  if (!target) throw new Error('Usage: mock-data.js attach <student e-mail>');
  const [student] = await query(
    'SELECT s.id AS student_id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = ?',
    [target.toLowerCase()],
  );
  if (!student) throw new Error(`No student account ${target}`);
  const [pastClass] = await query(
    "SELECT id FROM classes WHERE name = 'Grade 9 - A (Mock)' AND academic_year = ?",
    [PAST_YEAR],
  );
  if (!pastClass) throw new Error('Run `add` first: last year’s mock class is missing.');
  const [active] = await query(
    "SELECT class_id, enrolled_on FROM enrollments WHERE student_id = ? AND status = 'active'",
    [student.studentId],
  );
  const ability = 0.7 + rand() * 0.25;
  const scoreOf = (maxScore) => Math.round(maxScore * Math.min(1, ability + (rand() - 0.5) * 0.2) * 2) / 2;

  const summary = await withTransaction(async (conn) => {
    const gradeRows = [];
    // Last year: a completed place in Grade 9 - A (Mock) and a grade on each of its assessments.
    const pastEnrolled = await query(
      'SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ?',
      [student.studentId, pastClass.id],
      conn,
    );
    if (!pastEnrolled.length) {
      await run(
        "INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES (?, ?, 'completed', ?, ?)",
        [student.studentId, pastClass.id, academicYearStart(PAST_YEAR), YEAR_START],
        conn,
      );
    }
    const pastAssessments = await query(
      `SELECT a.id, a.max_score, t.user_id AS grader FROM assessments a
       JOIN class_subjects cs ON cs.id = a.class_subject_id JOIN teachers t ON t.id = cs.teacher_id
       WHERE cs.class_id = ? AND a.id NOT IN (SELECT assessment_id FROM grades WHERE student_id = ?)`,
      [pastClass.id, student.studentId],
      conn,
    );
    for (const a of pastAssessments)
      gradeRows.push([a.id, student.studentId, scoreOf(a.maxScore), null, a.grader]);

    // This year: "[Mock]" assessments in each lesson of the student's current class, graded.
    let added = 0;
    if (active) {
      const lessons = await query(
        'SELECT cs.id, t.user_id AS grader FROM class_subjects cs JOIN teachers t ON t.id = cs.teacher_id WHERE cs.class_id = ?',
        [active.classId],
        conn,
      );
      const plan = [
        ['[Mock] Quiz 1', 'quiz', 20, 17],
        ['[Mock] Quiz 2', 'quiz', 20, 31],
        ['[Mock] Unit test', 'test', 50, 45],
        ['[Mock] Reflection paper', 'assignment', 10, 52],
        ['[Mock] Group project', 'project', 50, 38],
        ['[Mock] 1st quarterly exam', 'exam', 50, 58],
      ];
      for (const [index, lesson] of lessons.entries()) {
        for (const [title, type, maxScore, offset] of plan) {
          const day = weekdayFrom(addDaysYmd(YEAR_START, offset + index));
          if (day >= TODAY) continue;
          const exists = await query(
            'SELECT id FROM assessments WHERE class_subject_id = ? AND term = ? AND title = ?',
            [lesson.id, 'term1', title],
            conn,
          );
          const assessmentId = exists.length
            ? exists[0].id
            : (
                await run(
                  'INSERT INTO assessments (class_subject_id, title, type, term, max_score, assessed_on) VALUES (?, ?, ?, ?, ?, ?)',
                  [lesson.id, title, type, 'term1', maxScore, day],
                  conn,
                )
              ).insertId;
          gradeRows.push([assessmentId, student.studentId, scoreOf(maxScore), null, lesson.grader]);
          added += 1;
        }
      }
    }
    await run(
      'INSERT IGNORE INTO grades (assessment_id, student_id, score, remarks, graded_by) VALUES ?',
      [gradeRows],
      conn,
    );
    return { past: pastAssessments.length, current: added };
  });
  console.log(
    `✔ ${target}: ${summary.past} grades last year (${PAST_YEAR}, Grade 9 - A (Mock)), ${summary.current} this year in their own class.`,
  );
  console.log('  `remove` deletes them together with the rest of the mock school.');
}

const COMMANDS = { add, status, remove, attach };
const command = COMMANDS[process.argv[2]];
if (!command) {
  console.error(
    'Usage: node --env-file=<.env or .env.cloud> scripts/mock-data.js add | status | remove | attach <student e-mail>',
  );
  process.exitCode = 1;
} else {
  command()
    .catch((error) => {
      console.error(`✖ ${error.message}`);
      if (error.sqlMessage) console.error(`  ${error.sqlMessage}`);
      process.exitCode = 1;
    })
    .finally(closePool);
}
