import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/constants/shared';
import { CREATABLE_ROLE_OPTIONS } from '../src/constants/ui';
import { isAwaitingApproval } from '../src/features/assistantRequests/status';
import { PERMISSIONS, can, roleHome, roleLabel } from '../src/utils/roles';

/**
 * What an approved student assistant may do: everyday office work (backend tests/assistant.test.js, allowed
 * side), approving or declining the sign-ups of other assistants included.
 */
const ASSISTANT_ALLOWED = [
  'school.readAll',
  'assistantRequests.review',
  'subjects.manage',
  'teachers.create',
  'school.setUp',
  'enrollments.withdraw',
  'announcements.manageAll',
  'calendar.manage',
];

/** What stays with the admin: accounts other than students', what cannot be undone, grades. */
const ASSISTANT_DENIED = [
  'users.list',
  'users.setStatus',
  'users.delete',
  'teachers.manage',
  'enrollments.complete',
  'classes.delete',
  'classSubjects.delete',
  'lessons.manageAll',
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
    expect(can(undefined, 'calendar.manage')).toBe(false);
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

  it('is not offered by the Create user form: assistants sign up themselves (POST /users refuses them)', () => {
    expect(CREATABLE_ROLE_OPTIONS.map((option) => option.value).sort()).toEqual([
      'admin',
      'student',
      'teacher',
    ]);
  });
});

describe('isAwaitingApproval: who gets the waiting screen instead of the app', () => {
  const assistant = (assistantRequest) => ({ role: 'assistant', assistantRequest });
  const request = (status) => ({ status, declineReason: null, requestedAt: '2026-10-11T05:00:00.000Z' });

  it('is a student assistant whose request is pending or declined', () => {
    expect(isAwaitingApproval(assistant(request('pending')))).toBe(true);
    expect(isAwaitingApproval(assistant({ ...request('declined'), declineReason: 'Enough this term' }))).toBe(
      true,
    );
  });

  it('lets an approved assistant in, and one created before sign-up existed (no request)', () => {
    expect(isAwaitingApproval(assistant(request('approved')))).toBe(false);
    expect(isAwaitingApproval(assistant(null))).toBe(false);
    expect(isAwaitingApproval({ role: 'assistant' })).toBe(false);
  });

  it('never stops the other roles, nor a signed-out user', () => {
    for (const role of ['admin', 'teacher', 'student']) {
      expect(isAwaitingApproval({ role, assistantRequest: request('pending') })).toBe(false);
    }
    expect(isAwaitingApproval(null)).toBe(false);
    expect(isAwaitingApproval(undefined)).toBe(false);
  });
});
