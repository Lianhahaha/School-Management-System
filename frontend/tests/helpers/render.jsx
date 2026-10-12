import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConfirmProvider } from '../../src/components/ui/ConfirmProvider';
import { ToastProvider } from '../../src/components/ui/Toast';
import { AuthContext } from '../../src/features/auth/authContext';

/** A signed-in teacher, as GET /auth/me returns one (only the fields the screens under test read). */
export const TEACHER = Object.freeze({ id: 7, role: 'teacher', firstName: 'Rosa', lastName: 'Diaz' });

/**
 * Renders `ui` inside the app's providers: a fresh query cache that never retries, a session (`me`, or
 * nobody), the toasts, the confirm dialog and a data router (the sheets block leaving with unsaved edits,
 * which needs one). Returns Testing Library's result plus `user`, a user-event instance.
 * @param {import('react').ReactElement} ui
 * @param {{ me?: object | null }} [options]
 */
export function renderWithProviders(ui, { me = TEACHER } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session = {
    status: me ? 'authenticated' : 'anonymous',
    firebaseUser: null,
    me,
    role: me?.role ?? null,
    authNotice: null,
    setAuthNotice: () => {},
    logout: async () => {},
    refreshMe: async () => {},
  };
  const router = createMemoryRouter([{ path: '/', element: ui }]);

  const user = userEvent.setup();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={session}>
        <ToastProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </ToastProvider>
      </AuthContext>
    </QueryClientProvider>,
  );
  return { user, ...result };
}
