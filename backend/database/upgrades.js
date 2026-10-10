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
]);
