import { screen } from '@testing-library/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '../src/features/auth/components/RegisterForm';
import { register } from '../src/features/auth/api';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/features/auth/api', () => ({ register: vi.fn() }));
// The sign-in that follows a sign-up; nothing reaches Firebase.
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));

const LETTERS_ONLY = "Use letters only. Spaces, periods (.), apostrophes (') and hyphens (-) are fine.";
const PASSWORD = 'Str0ngPass!';

/** Puts `value` in a field the way a paste would (an emoji is one paste, not two half characters). */
async function fill(user, field, value) {
  await user.clear(field);
  await user.click(field);
  await user.paste(value);
}

/** The fields both kinds of account have. */
async function fillAccount(user, { firstName = 'Juan', lastName = 'Dela Cruz' } = {}) {
  await fill(user, screen.getByRole('textbox', { name: 'First name' }), firstName);
  await fill(user, screen.getByRole('textbox', { name: 'Last name' }), lastName);
  await fill(user, screen.getByRole('textbox', { name: 'Email' }), 'juan@example.com');
  await fill(user, screen.getByLabelText(/^Password/), PASSWORD);
  await fill(user, screen.getByLabelText(/^Confirm password/), PASSWORD);
}

/** The application a student sign-up requires. */
async function fillApplication(user) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Grade applying for' }), 'Grade 7');
  await fill(user, screen.getByRole('textbox', { name: 'Guardian name' }), 'Maria Dela Cruz');
  await fill(user, screen.getByRole('textbox', { name: 'Guardian phone' }), '+63 917 765 4321');
}

beforeEach(() => {
  vi.mocked(register).mockReset().mockResolvedValue({ id: 99 });
  vi.mocked(signInWithEmailAndPassword).mockReset().mockResolvedValue({});
});

describe('RegisterForm', () => {
  it.each([
    ['digits', 'Juan123'],
    ['an emoji', 'Juan 😀'],
  ])('refuses a name with %s and sends nothing', async (_, firstName) => {
    const { user } = renderWithProviders(<RegisterForm />, { me: null });

    await fillAccount(user, { firstName });
    await fillApplication(user);
    await user.click(screen.getByRole('button', { name: 'Create account and pick a class' }));

    expect(await screen.findByText(LETTERS_ONLY)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('sends a student sign-up with the names tidied and the application', async () => {
    const { user } = renderWithProviders(<RegisterForm />, { me: null });

    await fillAccount(user, { firstName: '  Juan  ', lastName: 'Dela    Cruz ' });
    await fillApplication(user);
    await user.click(screen.getByRole('button', { name: 'Create account and pick a class' }));

    expect(await screen.findByText('Welcome, Juan!')).toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      accountType: 'student',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juan@example.com',
      password: PASSWORD,
      gradeLevel: 7,
      guardianName: 'Maria Dela Cruz',
      guardianPhone: '+63 917 765 4321',
    });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'juan@example.com', PASSWORD);
  });

  it('asks a student assistant only for the account and sends an assistant request', async () => {
    const { user } = renderWithProviders(<RegisterForm />, { me: null });

    await user.click(screen.getByRole('radio', { name: /^Student assistant/ }));

    expect(screen.queryByRole('combobox', { name: 'Grade applying for' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Guardian name' })).not.toBeInTheDocument();
    expect(screen.getByText('The school office will review your request and email you.')).toBeInTheDocument();

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText('Request sent')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith({
      accountType: 'assistant',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juan@example.com',
      password: PASSWORD,
    });
  });
});
