import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { UPGRADES } from '../database/upgrades.js';
import { migrateDatabase } from '../src/config/migrations.js';
import { prepareDatabase, shutdown } from './helpers/db.js';
import { openSession } from './helpers/locks.js';

after(shutdown);

const UPGRADE_IDS = UPGRADES.map((upgrade) => upgrade.id);
const SEMESTER_UPGRADE = '2026-10-11-assessments-semester';
const PERIOD_KEY_UPGRADE = '2026-10-11-assessments-period-key';
const SHS_GROUPS_UPGRADE = '2026-10-12-subjects-shs-groups';

describe('database migrations', () => {
  let session;
  const rows = async (sql, params) => (await session.query(sql, params))[0];
  const recordedIds = async () =>
    (await rows('SELECT id FROM schema_migrations ORDER BY id')).map((row) => row.id);
  const hasColumn = async (table, column) =>
    (
      await rows(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      )
    ).length > 0;
  const hasIndex = async (table, index) =>
    (
      await rows(
        `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, index],
      )
    ).length > 0;
  /** Everything information_schema says about a column's definition. */
  const columnDefinition = async (table, column) =>
    (
      await rows(
        `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLLATION_NAME, ORDINAL_POSITION
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      )
    )[0];
  /** The columns of assessments' unique key on the period and title, in key order. */
  const periodKeyColumns = async () =>
    (
      await rows(
        `SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND INDEX_NAME = 'uq_assessments_cs_period_title'
          ORDER BY SEQ_IN_INDEX`,
      )
    ).map((row) => {
      assert.equal(row.NON_UNIQUE, 0, 'the key is unique');
      return row.COLUMN_NAME;
    });
  const hasTable = async (table) =>
    (
      await rows(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      )
    ).length > 0;
  /** The smallest set of rows an assessment can hang from, by raw SQL; returns the class-subject's id. */
  const makeClassSubject = async () => {
    await session.query(
      `INSERT INTO users (firebase_uid, email, first_name, last_name, role)
       VALUES ('uid-migration', 'migration@school.test', 'Mia', 'Migration', 'teacher')`,
    );
    await session.query(
      `INSERT INTO teachers (user_id, employee_number, hire_date)
       SELECT id, 'EMP-2020-0001', '2020-06-01' FROM users WHERE email = 'migration@school.test'`,
    );
    await session.query("INSERT INTO subjects (code, name) VALUES ('MIG', 'Migration')");
    await session.query(
      "INSERT INTO classes (name, grade_level, academic_year) VALUES ('Grade 7 - M', 7, '2026-2027')",
    );
    await session.query(
      `INSERT INTO class_subjects (class_id, subject_id, teacher_id)
       SELECT c.id, s.id, t.id FROM classes c, subjects s, teachers t WHERE s.code = 'MIG' AND c.name = 'Grade 7 - M'`,
    );
    return (await rows('SELECT id FROM class_subjects'))[0].id;
  };
  const migrate = async () => {
    const messages = [];
    const changed = await migrateDatabase({ log: (message) => messages.push(message) });
    return { changed, messages };
  };

  // Every case starts from a database built by today's schema.sql, as the tests do, which has never been
  // migrated: no schema_migrations table yet.
  beforeEach(async () => {
    await session?.end();
    await prepareDatabase();
    session = await openSession();
  });

  before(() => {
    assert.ok(UPGRADE_IDS.length > 0, 'database/upgrades.js lists no upgrades');
    assert.equal(new Set(UPGRADE_IDS).size, UPGRADE_IDS.length, 'upgrade ids must be unique');
  });

  after(() => session?.end());

  it('records schema.sql and every upgrade on a current database without altering it', async () => {
    const { changed, messages } = await migrate();
    assert.deepEqual(changed, ['schema.sql', ...UPGRADE_IDS]);
    assert.deepEqual(
      messages.filter((message) => message.startsWith('Upgraded')),
      [],
      'a database built from the current schema.sql needs no upgrade',
    );
    assert.deepEqual(await recordedIds(), ['schema.sql', ...UPGRADE_IDS].sort());
  });

  it('changes nothing on a second run', async () => {
    await migrate();
    const { changed, messages } = await migrate();
    assert.deepEqual(changed, []);
    assert.deepEqual(messages, []);
  });

  it('upgrades a database created by an older schema.sql', async () => {
    await migrate();
    const enumColumns = [
      ['users', 'role'],
      ['activity_log', 'actor_role'],
      ['assessments', 'term'],
      ['assessments', 'semester'],
      // Re-added with the three Grades 1-10 groups, then given the Senior High ones by their own upgrade.
      ['subjects', 'grading_group'],
    ];
    const definitions = () =>
      Promise.all(enumColumns.map(([table, column]) => columnDefinition(table, column)));
    const current = await definitions();
    // Put back what the upgrades removed or added, and forget that they ran.
    await session.query(
      `ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','student') NOT NULL
         COMMENT 'Single source of truth for RBAC. Immutable after creation'`,
    );
    await session.query(
      "ALTER TABLE activity_log MODIFY COLUMN actor_role ENUM('admin','teacher','student') NULL",
    );
    await session.query("ALTER TABLE assessments MODIFY COLUMN term ENUM('term1','term2','term3') NOT NULL");
    await session.query(
      `ALTER TABLE assessments
         DROP INDEX uq_assessments_cs_period_title, DROP COLUMN semester,
         ADD UNIQUE KEY uq_assessments_cs_term_title (class_subject_id, term, title)`,
    );
    await session.query('ALTER TABLE subjects DROP COLUMN grading_group');
    await session.query(
      'ALTER TABLE enrollments ADD UNIQUE KEY uq_enrollments_student_class (student_id, class_id)',
    );
    await session.query(
      'ALTER TABLE students DROP CHECK chk_students_lrn, DROP INDEX uq_students_lrn, DROP COLUMN lrn',
    );
    // Assessments of the older schema: a title used in two quarters, as the old key allowed.
    const classSubjectId = await makeClassSubject();
    await session.query(
      `INSERT INTO assessments (class_subject_id, title, type, term, max_score, assessed_on) VALUES
         (?, 'Quiz 1', 'quiz', 'term1', 20, '2026-08-20'),
         (?, 'Quiz 1', 'quiz', 'term2', 20, '2026-10-02'),
         (?, 'Exam', 'exam', 'term3', 100, '2026-12-01')`,
      [classSubjectId, classSubjectId, classSubjectId],
    );
    const assessmentsBefore = await rows('SELECT id, title, term FROM assessments ORDER BY id');
    await session.query('DELETE FROM schema_migrations WHERE id <> ?', ['schema.sql']);

    const { changed, messages } = await migrate();

    assert.deepEqual(changed, UPGRADE_IDS);
    assert.equal(messages.filter((message) => message.startsWith('Upgraded')).length, UPGRADE_IDS.length);
    assert.equal(await hasColumn('subjects', 'grading_group'), true);
    assert.equal(await hasIndex('enrollments', 'uq_enrollments_student_class'), false);
    assert.equal(await hasColumn('students', 'lrn'), true);
    assert.equal(await hasIndex('students', 'uq_students_lrn'), true);
    assert.deepEqual(await definitions(), current, 'the ENUM columns end up as schema.sql defines them');

    // Every assessment is still there, in the 1st Semester through the column's default.
    assert.equal(await hasColumn('assessments', 'semester'), true);
    assert.deepEqual(
      await rows('SELECT id, title, term, semester FROM assessments ORDER BY id'),
      assessmentsBefore.map((row) => ({ ...row, semester: 'sem1' })),
    );
    assert.equal(await hasIndex('assessments', 'uq_assessments_cs_term_title'), false);
    assert.deepEqual(await periodKeyColumns(), ['class_subject_id', 'semester', 'term', 'title']);
  });

  it('adds the semester column and swaps the unique key as two upgrades, in that order', () => {
    assert.ok(UPGRADE_IDS.indexOf(SEMESTER_UPGRADE) >= 0 && UPGRADE_IDS.includes(PERIOD_KEY_UPGRADE));
    assert.ok(
      UPGRADE_IDS.indexOf(SEMESTER_UPGRADE) < UPGRADE_IDS.indexOf(PERIOD_KEY_UPGRADE),
      'the key names the column, so the column comes first',
    );
  });

  it('swaps the assessments unique key alone when the semester column is already there', async () => {
    await migrate();
    const classSubjectId = await makeClassSubject();
    await session.query(
      `ALTER TABLE assessments
         DROP INDEX uq_assessments_cs_period_title,
         ADD UNIQUE KEY uq_assessments_cs_term_title (class_subject_id, term, title)`,
    );
    await session.query("DELETE FROM schema_migrations WHERE id = '2026-10-11-assessments-period-key'");
    const addQuiz = (semester) =>
      session.query(
        `INSERT INTO assessments (class_subject_id, title, type, semester, term, max_score, assessed_on)
         VALUES (?, 'Quiz 1', 'quiz', ?, 'term1', 20, '2026-10-02')`,
        [classSubjectId, semester],
      );
    await addQuiz('sem1');
    await assert.rejects(addQuiz('sem2'), { code: 'ER_DUP_ENTRY' }, 'the old key ignores the semester');

    const { changed, messages } = await migrate();

    assert.deepEqual(changed, [PERIOD_KEY_UPGRADE]);
    assert.deepEqual(
      messages.filter((message) => message.startsWith('Upgraded')),
      [
        'Upgraded: replace assessments.uq_assessments_cs_term_title with uq_assessments_cs_period_title ' +
          `(${PERIOD_KEY_UPGRADE})`,
      ],
    );
    assert.equal(await hasIndex('assessments', 'uq_assessments_cs_term_title'), false);
    assert.deepEqual(await periodKeyColumns(), ['class_subject_id', 'semester', 'term', 'title']);
    await addQuiz('sem2'); // the same title and quarter of the other semester now fits
    await assert.rejects(addQuiz('sem1'), {
      code: 'ER_DUP_ENTRY',
      message: /uq_assessments_cs_period_title/,
    });
    const [foreignKey] = await rows(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND REFERENCED_TABLE_NAME = 'class_subjects'`,
    );
    assert.equal(foreignKey?.CONSTRAINT_NAME, 'fk_assessments_class_subject', 'the foreign key stays');
  });

  it('appends the Senior High groups to the Grades 1-10 ones, keeping every subject in its group', async () => {
    await migrate();
    const current = await columnDefinition('subjects', 'grading_group');
    // The column as upgrade 2026-10-08-subjects-grading-group made it, with a subject in each group it knew.
    await session.query(
      `ALTER TABLE subjects MODIFY COLUMN grading_group ENUM('languages','math_science','mapeh') NULL
         COMMENT 'K-12 components group; NULL = points or custom weights'`,
    );
    await session.query(
      `INSERT INTO subjects (code, name, grading_group) VALUES
         ('ENG', 'English', 'languages'), ('MATH', 'Mathematics', 'math_science'),
         ('MAPEH', 'MAPEH', 'mapeh'), ('HR', 'Homeroom', NULL)`,
    );
    const subjectsBefore = await rows('SELECT id, code, grading_group FROM subjects ORDER BY id');
    assert.notEqual((await columnDefinition('subjects', 'grading_group')).COLUMN_TYPE, current.COLUMN_TYPE);
    await session.query('DELETE FROM schema_migrations WHERE id = ?', [SHS_GROUPS_UPGRADE]);

    const { changed, messages } = await migrate();

    assert.deepEqual(changed, [SHS_GROUPS_UPGRADE]);
    assert.deepEqual(messages, [
      `Upgraded: add the Senior High groups to subjects.grading_group (${SHS_GROUPS_UPGRADE})`,
    ]);
    assert.deepEqual(
      await columnDefinition('subjects', 'grading_group'),
      current,
      'the column ends up as schema.sql defines it: the same type, NULL, comment and place',
    );
    assert.deepEqual(await rows('SELECT id, code, grading_group FROM subjects ORDER BY id'), subjectsBefore);
    for (const group of ['shs_core', 'shs_academic', 'shs_immersion', 'shs_tvl']) {
      await session.query('INSERT INTO subjects (code, name, grading_group) VALUES (?, ?, ?)', [
        group.toUpperCase().replace('_', '-'),
        group,
        group,
      ]);
    }

    // Run again, the upgrade forgotten once more: it is recorded without running, as its change is in place.
    await session.query('DELETE FROM schema_migrations WHERE id = ?', [SHS_GROUPS_UPGRADE]);
    const again = await migrate();
    assert.deepEqual(again.changed, [SHS_GROUPS_UPGRADE]);
    assert.deepEqual(again.messages, []);
    assert.deepEqual(await migrate(), { changed: [], messages: [] });
  });

  it('finds the Senior High upgrade needed while any one of its four groups is missing', async () => {
    await migrate();
    const { needed } = UPGRADES.find((upgrade) => upgrade.id === SHS_GROUPS_UPGRADE);
    const seniorHigh = ['shs_core', 'shs_academic', 'shs_immersion', 'shs_tvl'];
    assert.deepEqual(await rows(needed), [], 'not needed on a database built from schema.sql');
    for (const missing of seniorHigh) {
      const values = [
        'languages',
        'math_science',
        'mapeh',
        ...seniorHigh.filter((group) => group !== missing),
      ];
      await session.query(
        `ALTER TABLE subjects MODIFY COLUMN grading_group ENUM(${values.map((value) => `'${value}'`).join(',')}) NULL`,
      );
      assert.equal((await rows(needed)).length, 1, `needed without ${missing}`);
    }
  });

  it('applies a changed schema.sql again, creating a table that is missing', async () => {
    await migrate();
    await session.query('DROP TABLE announcement_reads');
    await session.query("UPDATE schema_migrations SET checksum = REPEAT('0', 64) WHERE id = 'schema.sql'");

    const { changed } = await migrate();

    assert.deepEqual(changed, ['schema.sql']);
    assert.equal(await hasTable('announcement_reads'), true);
  });

  it('runs the upgrades in order and records an upgrade that is no longer needed without running it', async () => {
    await migrate();
    const ran = [];
    const extra = [
      {
        id: '9999-01-01-test-needed',
        description: 'test upgrade that is needed',
        needed: 'SELECT 1',
        apply: "DO 'needed'",
      },
      {
        id: '9999-01-02-test-done',
        description: 'test upgrade already in place',
        needed: 'SELECT 1 FROM DUAL WHERE FALSE',
        apply: 'THIS IS NOT SQL',
      },
    ];
    const changed = await migrateDatabase({ upgrades: [...UPGRADES, ...extra], log: (m) => ran.push(m) });

    assert.deepEqual(
      changed,
      extra.map((upgrade) => upgrade.id),
    );
    assert.deepEqual(ran, ['Upgraded: test upgrade that is needed (9999-01-01-test-needed)']);
  });
});
