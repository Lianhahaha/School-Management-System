-- =============================================================================
-- School Management System — MySQL 8.0 schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Requires MySQL >= 8.0.19: the API's bulk upserts use the row alias of
-- INSERT ... AS new ON DUPLICATE KEY UPDATE (8.0.19); CHECKs are enforced from 8.0.16.
-- Validated on MySQL 8.0.43 with sql_mode = STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,...
-- Run:   npm run db:migrate   (scripts/migrate.js creates the database named by
--        DB_NAME, selects it, then executes this file over a dedicated mysql2
--        connection with multipleStatements: true). This file therefore contains
--        no CREATE DATABASE / USE statement.
-- Order: tables appear in dependency order (parents before children).
-- Delete policy: every FK is ON DELETE RESTRICT — nothing is ever removed
-- implicitly. Users are deactivated (is_active = 0) once anything refers to them; only an
-- unused account (no history) can be deleted, profile row first.
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1. users — one row per account of ANY role (admin / teacher / student).
--    Identity (password, tokens, MFA) lives in Firebase Auth. This row stores
--    the profile, the role and the active flag, keyed by firebase_uid.
--    Never hard-deleted: the API sets is_active = 0 (and disables the Firebase
--    user) instead.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_uid  VARCHAR(128) COLLATE utf8mb4_bin NOT NULL
                COMMENT 'Firebase Auth UID. Opaque, case-sensitive => binary collation so abc <> ABC',
  email         VARCHAR(255) NOT NULL
                COMMENT 'Lower-cased by the API before insert; the _ci collation makes the UNIQUE case-insensitive',
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(30)  NULL,
  role          ENUM('admin','teacher','student') NOT NULL
                COMMENT 'Single source of truth for RBAC. Immutable after creation',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
                COMMENT 'Stored as tinyint(1). 0 = deactivated: API rejects the request even if the Firebase token is valid',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_firebase_uid (firebase_uid),           -- token -> user lookup on EVERY API request
  UNIQUE KEY uq_users_email        (email),                  -- one account per e-mail; search by e-mail
  KEY        idx_users_role_active (role, is_active),        -- "all active teachers", dashboard counts
  KEY        idx_users_name        (last_name, first_name)   -- name search (prefix LIKE) + default sort order
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Accounts of all roles; identity in Firebase, profile + role here';

-- -----------------------------------------------------------------------------
-- 2. teachers — role-specific profile, exactly one row per user with role =
--    'teacher' (enforced 1:1 by UNIQUE(user_id); role match is guaranteed by
--    the API, which inserts users + teachers in one transaction).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL COMMENT '1:1 -> users.id (role = teacher)',
  employee_number  VARCHAR(20)  NOT NULL
                   COMMENT 'EMP-YYYY-NNNN; YYYY = year issued (hire year), NNNN = per-year sequence',
  hire_date        DATE         NOT NULL,
  department       VARCHAR(100) NULL COMMENT 'e.g. Mathematics; what teacher lists filter on',
  qualification    VARCHAR(150) NULL COMMENT 'e.g. B.Ed. Mathematics',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teachers_user   (user_id),          -- enforces the 1:1 with users
  UNIQUE KEY uq_teachers_number (employee_number),  -- lookup / search by employee number
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,          -- the profile row goes first; a stray user delete fails loudly
  CONSTRAINT chk_teachers_number CHECK (employee_number REGEXP '^EMP-[0-9]{4}-[0-9]{4,}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Teacher profile (1:1 with users)';

-- -----------------------------------------------------------------------------
-- 3. students — role-specific profile, exactly one row per user with role =
--    'student'. Which class the student is in is NOT stored here: it is derived
--    from enrollments (status = active) so history is never overwritten.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL COMMENT '1:1 -> users.id (role = student)',
  student_number  VARCHAR(20)  NOT NULL
                  COMMENT 'STU-YYYY-NNNN; YYYY = admission year, NNNN = per-year sequence (resets yearly)',
  date_of_birth   DATE         NULL,
  gender          ENUM('male','female','other') NULL,
  address         VARCHAR(255) NULL,
  guardian_name   VARCHAR(150) NULL,
  guardian_phone  VARCHAR(30)  NULL,
  admission_date  DATE         NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user   (user_id),          -- enforces the 1:1 with users
  UNIQUE KEY uq_students_number (student_number),   -- lookup / search by student number
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,          -- the profile row goes first; a stray user delete fails loudly
  CONSTRAINT chk_students_number CHECK (student_number REGEXP '^STU-[0-9]{4}-[0-9]{4,}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student profile (1:1 with users); current class lives in enrollments';

-- -----------------------------------------------------------------------------
-- 4. subjects — master list, independent of year/class ("Mathematics").
--    is_active lets an admin retire a subject that already has history
--    (it cannot be hard-deleted once class_subjects reference it).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(20)  NOT NULL COMMENT 'Short unique code, e.g. MATH',
  name         VARCHAR(100) NOT NULL,
  description  TEXT         NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE COMMENT 'Stored as tinyint(1). 0 = retired, hidden from new assignments',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code),   -- business key; lookup by code
  KEY        idx_subjects_name (name)   -- search / sort by name (same name may exist under 2 codes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Subject catalogue';

-- -----------------------------------------------------------------------------
-- 5. classes — a section in one academic year ("Grade 10 - A", 2025-2026).
--    A new row is created every year; old rows are history and are never
--    deleted (RESTRICT everywhere). Optional homeroom teacher.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(50)      NOT NULL COMMENT 'Display label, e.g. "Grade 10 - A"',
  grade_level          TINYINT UNSIGNED NOT NULL COMMENT 'Structured grade for filter/sort (name is free text)',
  academic_year        VARCHAR(9)       NOT NULL COMMENT 'YYYY-YYYY, e.g. 2025-2026 (fixed width => sorts correctly as text)',
  homeroom_teacher_id  INT UNSIGNED     NULL     COMMENT 'Optional class teacher',
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classes_year_name  (academic_year, name),        -- "Grade 10 - A" exists once per year
  KEY        idx_classes_year_grade (academic_year, grade_level), -- list classes of a year, filter by grade
  KEY        idx_classes_homeroom   (homeroom_teacher_id),        -- FK + "which class is teacher X homeroom of"
  CONSTRAINT fk_classes_homeroom_teacher FOREIGN KEY (homeroom_teacher_id) REFERENCES teachers (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,   -- teachers are never deleted; SET NULL would hide a bad delete
  CONSTRAINT chk_classes_academic_year CHECK (
    academic_year REGEXP '^[0-9]{4}-[0-9]{4}$'
    AND CAST(SUBSTRING(academic_year, 6, 4) AS UNSIGNED) = CAST(SUBSTRING(academic_year, 1, 4) AS UNSIGNED) + 1
  ),
  CONSTRAINT chk_classes_grade_level CHECK (grade_level BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Class section within one academic year';

-- -----------------------------------------------------------------------------
-- 6. class_subjects — TEACHER ASSIGNMENT: "teacher T teaches subject S to
--    class C". One teacher per subject per class (UNIQUE(class_id, subject_id)).
--    Everything that happens in a lesson (schedule slot, attendance, assessment)
--    hangs off this row, so it is the hub of the schema.
--    Changing the teacher is an UPDATE of teacher_id, never delete + insert.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_subjects (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id    INT UNSIGNED NOT NULL,
  subject_id  INT UNSIGNED NOT NULL,
  teacher_id  INT UNSIGNED NOT NULL COMMENT 'The assignment IS the row, so a teacher is mandatory',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_class_subjects_class_subject (class_id, subject_id), -- one teacher per subject per class; also serves FK class_id
  KEY        idx_class_subjects_teacher (teacher_id),                 -- "my assignments" for the teacher dashboard
  KEY        idx_class_subjects_subject (subject_id),                 -- FK + "where is subject X taught"
  CONSTRAINT fk_class_subjects_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_class_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_class_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Teacher assignment: (class, subject) -> teacher';

-- -----------------------------------------------------------------------------
-- 7. enrollments — student <-> class membership WITH history.
--    Rule: a student has AT MOST ONE active enrollment at any time.
--    Enforced in the database by active_flag (generated: 1 when active, NULL
--    otherwise) + UNIQUE(student_id, active_flag): NULLs never collide in a
--    UNIQUE index, so any number of closed rows coexist with at most one open
--    row. A transfer = close the old row THEN insert the new one (same tx).
--    Every enrollment is a new row, also a return to a class the student left,
--    so each [enrolled_on, left_on) period survives: rosters of past dates
--    (attendance sheets, grade rosters) are read from these periods.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id   INT UNSIGNED NOT NULL,
  class_id     INT UNSIGNED NOT NULL,
  status       ENUM('active','completed','transferred','withdrawn') NOT NULL DEFAULT 'active'
               COMMENT 'completed = finished the year; transferred = moved to another class; withdrawn = left school',
  enrolled_on  DATE NOT NULL,
  left_on      DATE NULL COMMENT 'NULL while active; mandatory once closed (see CHECK)',
  active_flag  TINYINT UNSIGNED GENERATED ALWAYS AS (IF(status = 'active', 1, NULL)) STORED
               COMMENT '1 for the active row, NULL otherwise. Exists only to drive uq_enrollments_one_active',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollments_one_active    (student_id, active_flag), -- THE "one active enrollment" rule; also serves FK student_id
  KEY        idx_enrollments_class_status (class_id, status),       -- roster of a class (active rows or a past date); also serves FK class_id
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_enrollments_class   FOREIGN KEY (class_id)   REFERENCES classes  (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_enrollments_dates  CHECK (left_on IS NULL OR left_on >= enrolled_on),
  CONSTRAINT chk_enrollments_status_left CHECK (
    (status = 'active' AND left_on IS NULL) OR (status <> 'active' AND left_on IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student membership in a class, with history; at most one active row per student';

-- -----------------------------------------------------------------------------
-- 8. schedules — weekly timetable slots of a class_subject.
--    day_of_week is ISO 8601 (1 = Monday ... 7 = Sunday). Overlap prevention
--    (same class / same teacher / same room) is a query at insert/update time
--    (see key query D4); a UNIQUE/CHECK cannot express interval overlap.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  class_subject_id  INT UNSIGNED     NOT NULL,
  day_of_week       TINYINT UNSIGNED NOT NULL COMMENT 'ISO 8601: 1 = Monday ... 7 = Sunday (MySQL WEEKDAY()+1)',
  start_time        TIME             NOT NULL,
  end_time          TIME             NOT NULL,
  room              VARCHAR(50)      NULL COMMENT 'Free text; normalised (trimmed) by the API. NULL = unassigned',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedules_cs_day_start (class_subject_id, day_of_week, start_time), -- exact duplicate slot guard; also serves FK
  KEY        idx_schedules_day_time    (day_of_week, start_time, end_time),         -- "today's timetable", overlap scan per day
  KEY        idx_schedules_room_day    (room, day_of_week),                         -- room conflict check
  CONSTRAINT fk_schedules_class_subject FOREIGN KEY (class_subject_id) REFERENCES class_subjects (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,   -- removing an assignment must clear its timetable explicitly first
  CONSTRAINT chk_schedules_day  CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_schedules_time CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Weekly timetable slots';

-- -----------------------------------------------------------------------------
-- 9. attendance — one row per student per class_subject per date.
--    Marked by a user (the teacher of the class_subject or an admin).
--    Marking is an upsert on the UNIQUE key (re-marking corrects the row).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id        INT UNSIGNED NOT NULL,
  class_subject_id  INT UNSIGNED NOT NULL,
  attendance_date   DATE         NOT NULL,
  status            ENUM('present','absent','late','excused') NOT NULL,
  marked_by         INT UNSIGNED NOT NULL COMMENT 'users.id of the teacher/admin who marked (audit)',
  remarks           VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_student_cs_date (student_id, class_subject_id, attendance_date), -- one mark per student/lesson/day; serves FK student_id; student summaries
  KEY        idx_attendance_cs_date        (class_subject_id, attendance_date),             -- teacher's register for a lesson/date; FK class_subject_id
  KEY        idx_attendance_date_status    (attendance_date, status),                       -- admin "today" summary, date-range reports
  KEY        idx_attendance_marked_by      (marked_by),                                     -- FK
  CONSTRAINT fk_attendance_student       FOREIGN KEY (student_id)       REFERENCES students       (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attendance_class_subject FOREIGN KEY (class_subject_id) REFERENCES class_subjects (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attendance_marked_by     FOREIGN KEY (marked_by)        REFERENCES users          (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Daily attendance per student per class_subject';

-- -----------------------------------------------------------------------------
-- 10. assessments — a graded event of a class_subject (quiz, exam, ...).
--     max_score lives HERE once, not on every grade row (normalised).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_subject_id  INT UNSIGNED NOT NULL,
  title             VARCHAR(150) NOT NULL,
  type              ENUM('quiz','test','exam','assignment','project','other') NOT NULL,
  term              ENUM('term1','term2','term3') NOT NULL,
  max_score         DECIMAL(6,2) NOT NULL COMMENT 'Exact decimal, never FLOAT. Grades are validated against it by the API',
  assessed_on       DATE         NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assessments_cs_term_title (class_subject_id, term, title), -- no accidental double-create; serves FK; per-term listing
  KEY        idx_assessments_date         (assessed_on),                   -- date-range filters / "recent assessments"
  CONSTRAINT fk_assessments_class_subject FOREIGN KEY (class_subject_id) REFERENCES class_subjects (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_assessments_max_score CHECK (max_score > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Graded events (quiz/test/exam/...) of a class_subject';

-- -----------------------------------------------------------------------------
-- 11. grades — one score per student per assessment.
--     score <= assessments.max_score cannot be a CHECK (cross-table): the API
--     validates it inside the same transaction (optional trigger backstop in
--     the design document).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_id  INT UNSIGNED NOT NULL,
  student_id     INT UNSIGNED NOT NULL,
  score          DECIMAL(6,2) NOT NULL,
  remarks        VARCHAR(255) NULL,
  graded_by      INT UNSIGNED NOT NULL COMMENT 'users.id of the teacher/admin who entered the score (audit)',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grades_assessment_student (assessment_id, student_id), -- one score per student per assessment; serves FK assessment_id
  KEY        idx_grades_student           (student_id),                -- student's grade summary / report card
  KEY        idx_grades_graded_by         (graded_by),                 -- FK
  CONSTRAINT fk_grades_assessment FOREIGN KEY (assessment_id) REFERENCES assessments (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,   -- deleting an assessment with grades is an explicit 2-step in the API
  CONSTRAINT fk_grades_student    FOREIGN KEY (student_id)    REFERENCES students (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_grades_graded_by  FOREIGN KEY (graded_by)     REFERENCES users    (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_grades_score CHECK (score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scores per student per assessment';

-- -----------------------------------------------------------------------------
-- 12. announcements — audience = role filter, class_id = optional class scope.
--     Visible when published_at <= now < expires_at (NULL = never expires).
--     class_id is RESTRICT on purpose: SET NULL would silently turn a
--     class-targeted notice into a school-wide one.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id     INT UNSIGNED NOT NULL COMMENT 'users.id (admin or teacher)',
  title         VARCHAR(200) NOT NULL,
  body          TEXT         NOT NULL,
  audience      ENUM('all','students','teachers') NOT NULL DEFAULT 'all',
  class_id      INT UNSIGNED NULL COMMENT 'NULL = school-wide; set = only members of that class',
  published_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Future value = scheduled (hidden until then)',
  expires_at    DATETIME NULL COMMENT 'NULL = never expires',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_published          (published_at),            -- feed ordering (newest first) + visibility window
  KEY idx_announcements_audience_published (audience, published_at),  -- admin filter by audience
  KEY idx_announcements_class              (class_id),                -- FK + class-targeted feed
  KEY idx_announcements_author             (author_id),               -- FK + "my announcements"
  CONSTRAINT fk_announcements_author FOREIGN KEY (author_id) REFERENCES users   (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_announcements_class  FOREIGN KEY (class_id)  REFERENCES classes (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_announcements_expiry CHECK (expires_at IS NULL OR expires_at > published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Announcements with role audience and optional class scope';

-- -----------------------------------------------------------------------------
-- 13. subject_grade_weights — how much each assessment type counts towards a
--     subject's result ("quizzes 20 %, tests 30 %, exams 50 %"). One row per
--     type with a weight above 0; the weights of a subject add up to 100 (the
--     API checks the sum, a CHECK cannot span rows). A subject without rows is
--     graded on points: SUM(score) / SUM(max_score).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject_grade_weights (
  subject_id       INT UNSIGNED NOT NULL,
  assessment_type  ENUM('quiz','test','exam','assignment','project','other') NOT NULL,
  weight           TINYINT UNSIGNED NOT NULL COMMENT 'Percent of the subject result, 1-100',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subject_id, assessment_type),   -- one weight per type; also serves the FK
  CONSTRAINT fk_subject_grade_weights_subject FOREIGN KEY (subject_id) REFERENCES subjects (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,     -- deleting a subject removes its weights explicitly first
  CONSTRAINT chk_subject_grade_weights_weight CHECK (weight BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Weight of each assessment type in a subject result; none = graded on points';

-- -----------------------------------------------------------------------------
-- 14. calendar_events — the school calendar: holidays (no classes, so no
--     attendance can be marked on those days) and school events (classes as
--     usual). School-wide; a one-day entry has ends_on = starts_on.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(150) NOT NULL,
  description  VARCHAR(500) NULL,
  type         ENUM('holiday','event') NOT NULL COMMENT 'holiday = no classes; event = classes as usual',
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL COMMENT 'Inclusive; equal to starts_on for one day',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_calendar_events_dates (starts_on, ends_on),        -- events overlapping a month; "is today a holiday"
  CONSTRAINT chk_calendar_events_dates CHECK (ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='School calendar: holidays and events';
