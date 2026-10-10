import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { UPGRADES } from '../database/upgrades.js';
import { migrateDatabase } from '../src/config/migrations.js';
import { prepareDatabase, shutdown } from './helpers/db.js';
import { openSession } from './helpers/locks.js';

after(shutdown);

const UPGRADE_IDS = UPGRADES.map((upgrade) => upgrade.id);

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
  const hasTable = async (table) =>
    (
      await rows(`SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [
        table,
      ])
    ).length > 0;
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
    // Put back what the two upgrades removed or added, and forget that they ran.
    await session.query('ALTER TABLE subjects DROP COLUMN grading_group');
    await session.query(
      'ALTER TABLE enrollments ADD UNIQUE KEY uq_enrollments_student_class (student_id, class_id)',
    );
    await session.query('DELETE FROM schema_migrations WHERE id <> ?', ['schema.sql']);

    const { changed, messages } = await migrate();

    assert.deepEqual(changed, UPGRADE_IDS);
    assert.equal(messages.filter((message) => message.startsWith('Upgraded')).length, UPGRADE_IDS.length);
    assert.equal(await hasColumn('subjects', 'grading_group'), true);
    assert.equal(await hasIndex('enrollments', 'uq_enrollments_student_class'), false);
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

    assert.deepEqual(changed, extra.map((upgrade) => upgrade.id));
    assert.deepEqual(ran, ['Upgraded: test upgrade that is needed (9999-01-01-test-needed)']);
  });
});
