import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/constants/shared';
import { PERMISSIONS, can, roleHome, roleLabel } from '../src/utils/roles';

/** What a student assistant may do: everyday office work (backend tests/assistant.test.js, allowed side). */
const ASSISTANT_ALLOWED = [
  'school.readAll',
  'enrollments.withdraw',
  'announcements.manageAll',
  'calendar.manage',
  'payments.record',
];

/** What stays with the admin: accounts other than students', what cannot be undone, money amounts, grades. */
const ASSISTANT_DENIED = [
  'school.setUp',
  'users.list',
  'users.setStatus',
  'users.delete',
  'teachers.manage',
  'enrollments.complete',
  'subjects.manage',
  'classes.delete',
  'classSubjects.delete',
  'lessons.manageAll',
  'fees.manage',
  'payments.remove',
];

describe('can: the student assistant', () => {
  it.each(ASSISTANT_ALLOWED)('may %s', (action) => {
    expect(can('assistant', action)).toBe(true);
  });

  it.each(ASSISTANT_DENIED)('may not %s', (action) => {
    expect(can('assistant', action)).toBe(false);
  });

  it('is covered on every action: the two lists above are the whole map', () => {
    expect([...ASSISTANT_ALLOWED, ...ASSISTANT_DENIED].sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });
});

describe('can: the other roles', () => {
  it('lets the admin take every action', () => {
    for (const action of Object.keys(PERMISSIONS)) expect(can('admin', action)).toBe(true);
  });

  it('lets teachers and students take none of the office actions', () => {
    for (const role of ['teacher', 'student']) {
      for (const action of Object.keys(PERMISSIONS)) expect(can(role, action)).toBe(false);
    }
  });

  it('refuses a signed-out user (no role)', () => {
    expect(can(null, 'school.readAll')).toBe(false);
    expect(can(undefined, 'payments.record')).toBe(false);
  });

  it('only names known roles', () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const role of roles) expect(ROLES).toContain(role);
    }
  });

  it('throws on an unknown action instead of quietly hiding a button', () => {
    expect(() => can('admin', 'classes.remove')).toThrow('Unknown permission "classes.remove"');
  });
});

describe('the assistant role in the UI', () => {
  it('is labelled "Student assistant" and works in the admin area', () => {
    expect(roleLabel('assistant')).toBe('Student assistant');
    expect(roleHome('assistant')).toBe('/admin');
  });
});
