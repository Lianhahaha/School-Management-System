/**
 * Versioned schema upgrades: changes CREATE TABLE IF NOT EXISTS cannot make to a database created by an
 * older schema.sql. src/config/migrations.js runs each one once, in this order, and records its id in the
 * schema_migrations table.
 *
 * To change an existing table: edit schema.sql (new databases get the change from there), then append an
 * upgrade here with a new id ('YYYY-MM-DD-what-it-does', never reused or renamed). `needed` is a SELECT that
 * returns a row only while the change is still missing, so an upgrade never runs twice even if recording it
 * failed, and a database created from the current schema.sql skips it. Upgrades only move forward: undoing
 * one is a new upgrade.
 *
 * @type {ReadonlyArray<{ id: string, description: string, needed: string, apply: string }>}
 */
export const UPGRADES = Object.freeze([
  {
    // Every enrollment is its own row now, so re-joining a class must not collide with the old period.
    id: '2026-10-04-enrollments-drop-uq-student-class',
    description: 'drop enrollments.uq_enrollments_student_class',
    needed: `SELECT 1 FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND INDEX_NAME = 'uq_enrollments_student_class'`,
    apply: 'ALTER TABLE enrollments DROP INDEX uq_enrollments_student_class',
  },
  {
    // K-12 grading: the subject group that sets a subject's component weights (NULL keeps today's grading).
    id: '2026-10-08-subjects-grading-group',
    description: 'add subjects.grading_group',
    needed: `SELECT 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'grading_group')`,
    apply: `ALTER TABLE subjects ADD COLUMN grading_group ENUM('languages','math_science','mapeh') NULL
              COMMENT 'K-12 components group; NULL = points or custom weights' AFTER is_active`,
  },
  {
    // DepEd's 12-digit Learner Reference Number, unique once issued (school forms SF1, SF2, SF9 and SF10).
    id: '2026-10-10-students-lrn',
    description: 'add students.lrn',
    needed: `SELECT 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'lrn')`,
    apply: `ALTER TABLE students
              ADD COLUMN lrn CHAR(12) NULL COMMENT 'DepEd LRN; NULL until issued' AFTER student_number,
              ADD UNIQUE KEY uq_students_lrn (lrn),
              ADD CONSTRAINT chk_students_lrn CHECK (lrn IS NULL OR lrn REGEXP '^[0-9]{12}$')`,
  },
  {
    // Student assistants, a fourth role. A value appended to an ENUM leaves every stored value as it is; the
    // rest of the column's definition (NOT NULL, comment) is restated unchanged.
    id: '2026-10-11-users-role-assistant',
    description: "add 'assistant' to users.role",
    needed: `SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
                AND COLUMN_TYPE NOT LIKE '%assistant%'`,
    apply: `ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','student','assistant') NOT NULL
              COMMENT 'Single source of truth for RBAC. Immutable after creation'`,
  },
  {
    // The activity log copies the actor's role, so it takes the new role too (the column stays nullable).
    id: '2026-10-11-activity-log-actor-role-assistant',
    description: "add 'assistant' to activity_log.actor_role",
    needed: `SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_log' AND COLUMN_NAME = 'actor_role'
                AND COLUMN_TYPE NOT LIKE '%assistant%'`,
    apply: `ALTER TABLE activity_log
              MODIFY COLUMN actor_role ENUM('admin','teacher','student','assistant') NULL`,
  },
  {
    // DepEd quarters: the three grading periods become four. term1 to term3 keep their stored values (only
    // their names in the app change, to the 1st to 3rd Quarter); term4 is appended for the 4th Quarter.
    id: '2026-10-11-term4',
    description: "add 'term4' to assessments.term",
    needed: `SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'term'
                AND COLUMN_TYPE NOT LIKE '%term4%'`,
    apply: `ALTER TABLE assessments MODIFY COLUMN term ENUM('term1','term2','term3','term4') NOT NULL`,
  },
]);
