import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Spinner } from '../ui/Spinner';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Brand } from './Brand';

/** The public pages (sign in, register, forgot password): wordmark, one sheet, theme switch. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <Brand />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center py-10">
        <main className="sheet w-full max-w-[26rem] p-6 sm:p-8">
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
    </div>
  );
}
