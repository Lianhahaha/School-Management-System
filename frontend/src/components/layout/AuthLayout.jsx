import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Spinner } from '../ui/Spinner';
import { Brand } from './Brand';

/** Centred card for the public pages (sign in, register, forgot password). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <Brand className="mb-6" />
      <main className="w-full max-w-md rounded-card border border-gray-200 bg-white p-6 shadow-card sm:p-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Spinner size="lg" label="Loading" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
