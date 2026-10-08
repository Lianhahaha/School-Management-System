import './helpers/setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSet } from '../src/utils/sql.js';
import { email, name, optionalText, phone, studentNumber } from '../src/utils/zod/common.js';

describe('shared validation rules', () => {
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
