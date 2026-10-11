import { describe, expect, it } from 'vitest';
import { REGISTER_FIELDS, registerDefaults, registerSchema } from '../src/features/auth/schemas';
import { FEW_SEATS_LEFT, isClassFullError, seatsLabel, seatsOf } from '../src/features/enrollments/seats';

/** The sign-up form as it holds its values: every input a string, the student fields there for both types. */
const form = (patch) => ({
  ...registerDefaults,
  firstName: 'Joy',
  lastName: 'Bautista',
  email: 'joy.bautista@example.com',
  password: 'Str0ngPass!',
  confirmPassword: 'Str0ngPass!',
  ...patch,
});

/** The issues of a failed parse as { field: message }. */
function issuesOf(result) {
  expect(result.success).toBe(false);
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}

describe('registerSchema: a student', () => {
  it('opens on a student sign-up', () => {
    expect(registerDefaults.accountType).toBe('student');
  });

  it('requires the grade applied for and the guardian, as the API does', () => {
    const issues = issuesOf(registerSchema.safeParse(form({ accountType: 'student' })));
    expect(Object.keys(issues).sort()).toEqual(['gradeLevel', 'guardianName', 'guardianPhone']);
  });

  it('sends the application with numbers as numbers and blank optional fields left out', () => {
    const result = registerSchema.safeParse(
      form({ gradeLevel: '7', guardianName: 'Maria Cruz', guardianPhone: '+63 917 765 4321', lrn: ' ' }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ accountType: 'student', gradeLevel: 7, guardianName: 'Maria Cruz' });
    expect(result.data.lrn).toBeUndefined();
    expect(result.data.previousSchool).toBeUndefined();
  });
});

describe('registerSchema: a student assistant', () => {
  it('needs the account fields only, and drops the student fields the form still holds', () => {
    const result = registerSchema.safeParse(
      form({
        accountType: 'assistant',
        gradeLevel: '7',
        guardianName: 'Maria Cruz',
        phone: '+63 917 555 0123',
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      accountType: 'assistant',
      firstName: 'Joy',
      lastName: 'Bautista',
      email: 'joy.bautista@example.com',
      password: 'Str0ngPass!',
      confirmPassword: 'Str0ngPass!',
      phone: '+63 917 555 0123',
    });
  });

  it('leaves out a blank phone', () => {
    const result = registerSchema.safeParse(form({ accountType: 'assistant' }));
    expect(result.success).toBe(true);
    expect(result.data.phone).toBeUndefined();
  });
});

describe('registerSchema: either kind', () => {
  it('refuses passwords that do not match', () => {
    for (const accountType of ['student', 'assistant']) {
      const values = form({
        accountType,
        confirmPassword: 'Another1!',
        gradeLevel: '7',
        guardianName: 'Maria Cruz',
        guardianPhone: '+63 917 765 4321',
      });
      expect(issuesOf(registerSchema.safeParse(values))).toEqual({
        confirmPassword: "Passwords don't match",
      });
    }
  });

  it('lists every field the form renders, for server errors', () => {
    expect([...REGISTER_FIELDS].sort()).toEqual(Object.keys(registerDefaults).sort());
  });
});

describe('seats of a section a student picks', () => {
  it('counts the seats left, never below zero', () => {
    expect(seatsOf({ enrolled: 28, seats: 35 })).toEqual({ left: 7, isFull: false, isFew: false });
    expect(seatsOf({ enrolled: 35, seats: 35 })).toEqual({ left: 0, isFull: true, isFew: false });
    // The office may enroll beyond the seats.
    expect(seatsOf({ enrolled: 37, seats: 35 })).toEqual({ left: 0, isFull: true, isFew: false });
  });

  it(`calls ${FEW_SEATS_LEFT} seats left or fewer "few"`, () => {
    expect(seatsOf({ enrolled: 35 - FEW_SEATS_LEFT, seats: 35 }).isFew).toBe(true);
    expect(seatsOf({ enrolled: 34 - FEW_SEATS_LEFT, seats: 35 }).isFew).toBe(false);
    expect(seatsOf({ enrolled: 44, seats: 45 }).isFew).toBe(true);
  });

  it('says it in words', () => {
    expect(seatsLabel({ enrolled: 28, seats: 35 })).toBe('28 of 35 seats taken');
    expect(seatsLabel({ enrolled: 33, seats: 35 })).toBe('33 of 35 seats taken · 2 left');
    expect(seatsLabel({ enrolled: 0, seats: 35 })).toBe('0 of 35 seats taken');
    expect(seatsLabel({ enrolled: 45, seats: 45 })).toBe('No seats left');
  });

  it('recognises the refusal of a section that filled up meanwhile', () => {
    expect(isClassFullError({ details: { reason: 'class_full', classId: 3, enrolled: 35, seats: 35 } })).toBe(
      true,
    );
    expect(isClassFullError({ details: { reason: 'not_eligible' } })).toBe(false);
    expect(isClassFullError(new Error('offline'))).toBe(false);
  });
});
