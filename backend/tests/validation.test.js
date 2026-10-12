import './helpers/setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSet } from '../src/utils/sql.js';
import {
  dateStr,
  dayOfWeek,
  email,
  gradeLevel,
  id,
  isoDateTime,
  name,
  optionalText,
  phone,
  studentNumber,
} from '../src/utils/zod/common.js';

describe('shared validation rules', () => {
  it('takes an id as a number or a string of digits, nothing looser', () => {
    assert.equal(id.parse(12), 12);
    assert.equal(id.parse('12'), 12);
    for (const bad of [true, [5], '0x10', '1e3', ' 5', 0, 1.5]) {
      assert.equal(id.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });

  it('takes a grade level or a weekday the same way, with one plain message', () => {
    assert.equal(gradeLevel.parse(12), 12);
    assert.equal(gradeLevel.parse('7'), 7);
    assert.equal(dayOfWeek.parse('1'), 1);
    for (const bad of [undefined, null, '', 'ten', true, [5], '0x0A', '1e1', 0, 13, 7.5]) {
      const result = gradeLevel.safeParse(bad);
      assert.equal(result.success, false, JSON.stringify(bad));
      assert.deepEqual(
        result.error.issues.map((issue) => issue.message),
        ['expected a grade level from 1 to 12'],
        JSON.stringify(bad),
      );
    }
    for (const bad of [undefined, 'monday', true, 0, 8]) {
      assert.deepEqual(
        dayOfWeek.safeParse(bad).error.issues.map((issue) => issue.message),
        ['expected a day from 1 (Monday) to 7 (Sunday)'],
        JSON.stringify(bad),
      );
    }
  });

  it('stops ids at the INT UNSIGNED columns that hold them', () => {
    assert.equal(id.parse(4294967295), 4294967295);
    assert.equal(id.parse('4294967295'), 4294967295);
    for (const bad of [4294967296, '4294967296', Number.MAX_SAFE_INTEGER, '99999999999999999999']) {
      assert.equal(id.safeParse(bad).success, false, String(bad));
    }
  });

  it('keeps dates and date-times within the years 1000 to 9998, a date-time judged in UTC', () => {
    for (const good of ['1000-01-01', '2026-10-12', '9998-12-31']) {
      assert.equal(dateStr.safeParse(good).success, true, good);
    }
    for (const bad of ['0999-12-31', '0100-01-01', '9999-01-01', '9999-12-31']) {
      assert.equal(dateStr.safeParse(bad).success, false, bad);
    }
    for (const good of ['1000-01-01T08:00:00+08:00', '2026-10-12T09:30:00Z', '9998-12-31T18:00:00-05:00']) {
      assert.equal(isoDateTime.safeParse(good).success, true, good);
    }
    for (const bad of [
      '1000-01-01T07:59:59+08:00', // 0999-12-31 in UTC
      '9998-12-31T23:00:00-05:00', // 9999-01-01 in UTC
      '9999-12-31T23:00:00-05:00', // 10000-01-01 in UTC
    ]) {
      assert.equal(isoDateTime.safeParse(bad).success, false, bad);
    }
  });

  it('trims and lower-cases an email before checking it', () => {
    assert.equal(email.parse('  Ana.Cruz@School.PH '), 'ana.cruz@school.ph');
    assert.equal(email.safeParse('not an email').success, false);
  });

  it('needs a letter in a name, and keeps capitals', () => {
    assert.equal(name.parse('maria clara'), 'Maria Clara');
    for (const bad of ['123', '---', '​']) assert.equal(name.safeParse(bad).success, false, bad);
  });

  it('needs at least seven digits in a phone number', () => {
    assert.equal(phone.parse('+63 917 555 0101'), '+63 917 555 0101');
    for (const bad of ['-------', '(  )  -  ', '12-34'])
      assert.equal(phone.safeParse(bad).success, false, bad);
  });

  it('stores blank optional text as null', () => {
    assert.equal(optionalText(255).parse('   '), null);
    assert.equal(optionalText(255).parse(' Room 4 '), 'Room 4');
  });

  it('caps student numbers at the column width', () => {
    assert.equal(studentNumber.safeParse('STU-2026-0001').success, true);
    assert.equal(studentNumber.safeParse('STU-2026-123456789012').success, false);
  });

  it('leaves a field set to undefined out of an UPDATE', () => {
    const set = buildSet({ phone: 'phone', firstName: 'first_name' }, { phone: undefined, firstName: 'Ana' });
    assert.deepEqual(set, { sql: 'first_name = ?', params: ['Ana'] });
    assert.equal(buildSet({ phone: 'phone' }, { phone: undefined }), null);
  });
});
