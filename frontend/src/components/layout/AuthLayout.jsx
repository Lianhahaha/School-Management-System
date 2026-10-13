import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';
import { useHealth } from '../../features/health/hooks';
import { cx } from '../../utils/cx';
import { Spinner } from '../ui/Spinner';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Brand } from './Brand';

/**
 * The public pages (sign in, register, forgot password, privacy): wordmark, one sheet, theme switch, and
 * a link to the Privacy Notice under the sheet. Opening one pings GET /health, so a sleeping API starts
 * waking while the visitor types. `wide` gives a reading page (the notice) a wider sheet.
 */
export function AuthLayout({ wide = false }) {
  useHealth();

  return (
    <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <Brand />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
        <main className={cx('sheet w-full p-6 sm:p-8', wide ? 'max-w-[46rem]' : 'max-w-[26rem]')}>
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
        {!wide && (
          <Link to="/privacy" className="text-xs text-gray-600 hover:text-gray-900">
            Privacy Notice
          </Link>
        )}
      </div>
    </div>
  );
}
