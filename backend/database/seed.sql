-- =============================================================================
-- seed.sql — demo data for the NON-user tables.
-- Executed by scripts/seed.js (npm run db:seed) over its mysql2 connection
-- (multipleStatements: true) right after it has created the 13 Firebase
-- accounts and the users / teachers / students rows. No mysql CLI is needed.
-- Order: npm run db:migrate (database/schema.sql) -> npm run db:seed (accounts +
-- this file); npm run db:reset drops the database and runs both again.
-- All ids are resolved by natural keys (e-mail, subject code, class name), so
-- nothing here depends on AUTO_INCREMENT values.
-- Session variables set by seed.js before this file runs (school time zone, so the
-- demo data lines up with what the API treats as "today"):
--   @today (DATE), @now_time (TIME), @now (DATETIME, UTC), @ay_start_month (1-12)
-- Dates are relative to @today so the demo looks "live" whenever it is run:
-- attendance covers last week (Mon-Fri) plus this week up to the current time.
-- Assumes the non-user tables are empty: seed.js refuses to run when `subjects`
-- already has rows (see also the reset block at the bottom).
-- =============================================================================
-- ---------- 0. Resolve ids created by scripts/seed.js --------------------------
SET @admin_user := (SELECT id FROM users WHERE email = 'admin@school.test');

SET @t1 := (SELECT t.id FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.email = 'teacher1@school.test');
SET @t2 := (SELECT t.id FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.email = 'teacher2@school.test');
SET @t3 := (SELECT t.id FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.email = 'teacher3@school.test');
SET @t1_user := (SELECT user_id FROM teachers WHERE id = @t1);
SET @t2_user := (SELECT user_id FROM teachers WHERE id = @t2);
SET @t3_user := (SELECT user_id FROM teachers WHERE id = @t3);

SET @s1 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student1@school.test');
SET @s2 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student2@school.test');
SET @s3 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student3@school.test');
SET @s4 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student4@school.test');
SET @s5 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student5@school.test');
SET @s6 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student6@school.test');
SET @s7 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student7@school.test');
SET @s8 := (SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'student8@school.test');

-- Guard: abort with a readable error if the account step of seed.js has not run
-- (only reachable when this file is executed by hand).
-- (A NULL id would otherwise surface later as a confusing NOT NULL / FK error.)
CREATE TEMPORARY TABLE seed_guard (
  ok TINYINT NOT NULL PRIMARY KEY,
  CONSTRAINT users_not_seeded CHECK (ok = 1)
);
INSERT INTO seed_guard (ok) VALUES (
  @admin_user IS NOT NULL AND @t1 IS NOT NULL AND @t2 IS NOT NULL AND @t3 IS NOT NULL
  AND @s1 IS NOT NULL AND @s2 IS NOT NULL AND @s3 IS NOT NULL AND @s4 IS NOT NULL
  AND @s5 IS NOT NULL AND @s6 IS NOT NULL AND @s7 IS NOT NULL AND @s8 IS NOT NULL
);
DROP TEMPORARY TABLE seed_guard;

-- ---------- 1. Dates -----------------------------------------------------------
-- The academic year starts in @ay_start_month (ACADEMIC_YEAR_START_MONTH in src/constants/shared.js, 8 = August).
SET @ay_start      := IF(MONTH(@today) >= @ay_start_month, YEAR(@today), YEAR(@today) - 1);
SET @academic_year := CONCAT(@ay_start, '-', @ay_start + 1);                     -- e.g. '2026-2027'
SET @enrolled_on   := LEAST(DATE(CONCAT(@ay_start, '-09-01')), DATE(@today));      -- classes start 1 Sept
SET @transfer_on   := LEAST(DATE(@enrolled_on) + INTERVAL 14 DAY, DATE(@today));         -- one demo transfer
SET @last_monday   := @today - INTERVAL (WEEKDAY(@today) + 7) DAY;        -- Monday of LAST week

-- ---------- 2. Subjects --------------------------------------------------------
INSERT INTO subjects (code, name, description) VALUES
  ('MATH', 'Mathematics',      'Algebra, geometry and introductory statistics'),
  ('ENG',  'English Language', 'Reading comprehension, composition and literature'),
  ('SCI',  'Science',          'Integrated biology, chemistry and physics'),
  ('HIST', 'History',          'World and national history'),
  ('CS',   'Computer Science', 'Programming fundamentals and digital literacy');

SET @subj_math := (SELECT id FROM subjects WHERE code = 'MATH');
SET @subj_eng  := (SELECT id FROM subjects WHERE code = 'ENG');
SET @subj_sci  := (SELECT id FROM subjects WHERE code = 'SCI');
SET @subj_hist := (SELECT id FROM subjects WHERE code = 'HIST');
SET @subj_cs   := (SELECT id FROM subjects WHERE code = 'CS');

-- ---------- 3. Classes (homeroom: 10-A = teacher1, 10-B = teacher3) -----------
INSERT INTO classes (name, grade_level, academic_year, homeroom_teacher_id) VALUES
  ('Grade 10 - A', 10, @academic_year, @t1),
  ('Grade 10 - B', 10, @academic_year, @t3);

SET @class_a := (SELECT id FROM classes WHERE academic_year = @academic_year AND name = 'Grade 10 - A');
SET @class_b := (SELECT id FROM classes WHERE academic_year = @academic_year AND name = 'Grade 10 - B');

-- ---------- 4. Teacher assignments (class_subjects) ----------------------------
-- teacher1 Alice Morgan : Mathematics + Computer Science (both classes)
-- teacher2 Brian Chen   : English + History               (both classes)
-- teacher3 Carla Diaz   : Science                         (both classes)
INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES
  (@class_a, @subj_math, @t1), (@class_a, @subj_cs,   @t1),
  (@class_a, @subj_eng,  @t2), (@class_a, @subj_hist, @t2),
  (@class_a, @subj_sci,  @t3),
  (@class_b, @subj_math, @t1), (@class_b, @subj_cs,   @t1),
  (@class_b, @subj_eng,  @t2), (@class_b, @subj_hist, @t2),
  (@class_b, @subj_sci,  @t3);

SET @cs_a_math := (SELECT id FROM class_subjects WHERE class_id = @class_a AND subject_id = @subj_math);
SET @cs_a_eng  := (SELECT id FROM class_subjects WHERE class_id = @class_a AND subject_id = @subj_eng);
SET @cs_a_sci  := (SELECT id FROM class_subjects WHERE class_id = @class_a AND subject_id = @subj_sci);
SET @cs_a_hist := (SELECT id FROM class_subjects WHERE class_id = @class_a AND subject_id = @subj_hist);
SET @cs_a_cs   := (SELECT id FROM class_subjects WHERE class_id = @class_a AND subject_id = @subj_cs);
SET @cs_b_math := (SELECT id FROM class_subjects WHERE class_id = @class_b AND subject_id = @subj_math);
SET @cs_b_eng  := (SELECT id FROM class_subjects WHERE class_id = @class_b AND subject_id = @subj_eng);
SET @cs_b_sci  := (SELECT id FROM class_subjects WHERE class_id = @class_b AND subject_id = @subj_sci);
SET @cs_b_hist := (SELECT id FROM class_subjects WHERE class_id = @class_b AND subject_id = @subj_hist);
SET @cs_b_cs   := (SELECT id FROM class_subjects WHERE class_id = @class_b AND subject_id = @subj_cs);

-- ---------- 5. Enrollments (students 1-4 -> 10-A, 5-8 -> 10-B) -----------------
-- student4 started in 10-B and was transferred to 10-A: shows the history model
-- (closed row keeps status/left_on; only ONE row per student is 'active').
INSERT INTO enrollments (student_id, class_id, status, enrolled_on, left_on) VALUES
  (@s1, @class_a, 'active',      @enrolled_on, NULL),
  (@s2, @class_a, 'active',      @enrolled_on, NULL),
  (@s3, @class_a, 'active',      @enrolled_on, NULL),
  (@s4, @class_b, 'transferred', @enrolled_on, @transfer_on),   -- closed first ...
  (@s4, @class_a, 'active',      @transfer_on, NULL),           -- ... then the new active row
  (@s5, @class_b, 'active',      @enrolled_on, NULL),
  (@s6, @class_b, 'active',      @enrolled_on, NULL),
  (@s7, @class_b, 'active',      @enrolled_on, NULL),
  (@s8, @class_b, 'active',      @enrolled_on, NULL);

-- ---------- 6. Weekly timetable (Mon-Fri, 3 periods/day, 30 slots) -------------
-- P1 08:00-08:50 | P2 09:00-09:50 | P3 10:10-11:00
-- Every subject meets 3x/week; no class, teacher or room is double-booked
-- (verified with query D4b). Each class_subject appears at most once per day.
INSERT INTO schedules (class_subject_id, day_of_week, start_time, end_time, room) VALUES
  -- Monday (1)
  (@cs_a_math, 1, '08:00:00', '08:50:00', 'Room 101'),
  (@cs_b_eng,  1, '08:00:00', '08:50:00', 'Room 102'),
  (@cs_a_eng,  1, '09:00:00', '09:50:00', 'Room 101'),
  (@cs_b_math, 1, '09:00:00', '09:50:00', 'Room 102'),
  (@cs_a_sci,  1, '10:10:00', '11:00:00', 'Lab 1'),
  (@cs_b_hist, 1, '10:10:00', '11:00:00', 'Room 102'),
  -- Tuesday (2)
  (@cs_a_cs,   2, '08:00:00', '08:50:00', 'Computer Lab'),
  (@cs_b_sci,  2, '08:00:00', '08:50:00', 'Lab 1'),
  (@cs_a_hist, 2, '09:00:00', '09:50:00', 'Room 101'),
  (@cs_b_cs,   2, '09:00:00', '09:50:00', 'Computer Lab'),
  (@cs_a_math, 2, '10:10:00', '11:00:00', 'Room 101'),
  (@cs_b_eng,  2, '10:10:00', '11:00:00', 'Room 102'),
  -- Wednesday (3)
  (@cs_a_eng,  3, '08:00:00', '08:50:00', 'Room 101'),
  (@cs_b_math, 3, '08:00:00', '08:50:00', 'Room 102'),
  (@cs_a_sci,  3, '09:00:00', '09:50:00', 'Lab 1'),
  (@cs_b_cs,   3, '09:00:00', '09:50:00', 'Computer Lab'),
  (@cs_a_math, 3, '10:10:00', '11:00:00', 'Room 101'),
  (@cs_b_hist, 3, '10:10:00', '11:00:00', 'Room 102'),
  -- Thursday (4)
  (@cs_a_hist, 4, '08:00:00', '08:50:00', 'Room 101'),
  (@cs_b_sci,  4, '08:00:00', '08:50:00', 'Lab 1'),
  (@cs_a_cs,   4, '09:00:00', '09:50:00', 'Computer Lab'),
  (@cs_b_eng,  4, '09:00:00', '09:50:00', 'Room 102'),
  (@cs_a_eng,  4, '10:10:00', '11:00:00', 'Room 101'),
  (@cs_b_cs,   4, '10:10:00', '11:00:00', 'Computer Lab'),
  -- Friday (5)
  (@cs_a_sci,  5, '08:00:00', '08:50:00', 'Lab 1'),
  (@cs_b_math, 5, '08:00:00', '08:50:00', 'Room 102'),
  (@cs_a_cs,   5, '09:00:00', '09:50:00', 'Computer Lab'),
  (@cs_b_hist, 5, '09:00:00', '09:50:00', 'Room 102'),
  (@cs_a_hist, 5, '10:10:00', '11:00:00', 'Room 101'),
  (@cs_b_sci,  5, '10:10:00', '11:00:00', 'Lab 1');

-- ---------- 7. Attendance: every scheduled lesson from last Monday to now -----
-- Generated from the timetable itself, so every row matches a real lesson day.
-- Lessons later today (end_time > now) are left unmarked so the dashboards show
-- "pending" items. Deterministic pseudo-random mix: ~70% present, 10% late,
-- 10% absent, 10% excused.
INSERT INTO attendance (student_id, class_subject_id, attendance_date, status, marked_by)
WITH RECURSIVE days AS (
  SELECT CAST(@last_monday AS DATE) AS dt
  UNION ALL
  SELECT dt + INTERVAL 1 DAY FROM days WHERE dt < @today
)
SELECT DISTINCT
  e.student_id,
  cs.id,
  d.dt,
  ELT(1 + ((e.student_id * 7 + cs.id * 3 + DAYOFMONTH(d.dt)) MOD 10),
      'present','present','present','present','present','present','present',
      'late','absent','excused'),
  t.user_id                                   -- marked by the lesson's teacher
FROM days d
JOIN schedules sch      ON sch.day_of_week = WEEKDAY(d.dt) + 1      -- ISO day
JOIN class_subjects cs  ON cs.id = sch.class_subject_id
JOIN teachers t         ON t.id = cs.teacher_id
JOIN enrollments e      ON e.class_id = cs.class_id                 -- the class roster on that day,
                       AND e.enrolled_on <= d.dt                    -- same rule as the API: joined by then
                       AND (e.left_on IS NULL OR e.left_on > d.dt)  -- and not yet left
WHERE d.dt < @today OR sch.end_time <= @now_time;

-- ---------- 8. Assessments + grades --------------------------------------------
INSERT INTO assessments (class_subject_id, title, type, term, max_score, assessed_on) VALUES
  (@cs_a_math, 'Algebra Quiz 1',               'quiz', 'term1', 20.00, CAST(@last_monday AS DATE) + INTERVAL 1 DAY),  -- Tue: 10-A has Maths
  (@cs_b_eng,  'Reading Comprehension Test 1', 'test', 'term1', 50.00, CAST(@last_monday AS DATE) + INTERVAL 3 DAY);  -- Thu: 10-B has English

SET @assess_math := (SELECT id FROM assessments WHERE class_subject_id = @cs_a_math AND term = 'term1' AND title = 'Algebra Quiz 1');
SET @assess_eng  := (SELECT id FROM assessments WHERE class_subject_id = @cs_b_eng  AND term = 'term1' AND title = 'Reading Comprehension Test 1');

INSERT INTO grades (assessment_id, student_id, score, remarks, graded_by) VALUES
  (@assess_math, @s1, 18.50, 'Excellent work',          @t1_user),
  (@assess_math, @s2, 14.00, NULL,                      @t1_user),
  (@assess_math, @s3, 11.00, 'Revise linear equations', @t1_user),
  (@assess_math, @s4, 19.00, NULL,                      @t1_user),
  (@assess_eng,  @s5, 42.00, NULL,                      @t2_user),
  (@assess_eng,  @s6, 35.50, NULL,                      @t2_user),
  (@assess_eng,  @s7, 28.00, 'See me about paragraph structure', @t2_user),
  (@assess_eng,  @s8, 46.00, 'Outstanding',             @t2_user);

-- ---------- 9. Announcements (one per audience type; one class-targeted) -------
INSERT INTO announcements (author_id, title, body, audience, class_id, published_at, expires_at) VALUES
  (@admin_user, 'Welcome to the new academic year',
   'Classes start at 08:00. Please check your timetable on the dashboard and report to your homeroom teacher on the first day.',
   'all', NULL, @now - INTERVAL 14 DAY, NULL),
  (@t1_user, 'Algebra Quiz 1 results published',
   'Results for Algebra Quiz 1 are now visible under Grades. Come to Room 101 during Tuesday break if you want to go through your paper.',
   'students', @class_a, @now - INTERVAL 2 DAY, @now + INTERVAL 12 DAY),
  (@admin_user, 'Staff meeting - Friday 15:00',
   'All teaching staff: term planning meeting in the staff room, Friday at 15:00. Attendance registers must be up to date before the meeting.',
   'teachers', NULL, @now - INTERVAL 1 DAY, @now + INTERVAL 6 DAY);

-- ---------- Reset (dev only) ---------------------------------------------------
-- Preferred: npm run db:reset (drops the database, migrate, seed).
-- Manual alternative — children before parents, so FK checks can stay ON:
-- DELETE FROM announcement_reads; DELETE FROM notifications; DELETE FROM activity_log;
-- DELETE FROM grades; DELETE FROM assessments; DELETE FROM attendance;
-- DELETE FROM schedules; DELETE FROM announcements; DELETE FROM enrollments;
-- DELETE FROM class_subjects; DELETE FROM subject_grade_weights; DELETE FROM classes;
-- DELETE FROM subjects; DELETE FROM calendar_events;
