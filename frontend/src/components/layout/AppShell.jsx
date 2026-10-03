import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { PageSkeleton } from './PageSkeleton';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_ID = 'app-sidebar';

/**
 * Frame of every signed-in page: skip link, sidebar (a fixed column from `lg` up, an off-canvas
 * drawer below), top bar and the routed page in <main>. Pages are lazy chunks, so the outlet sits
 * in a Suspense boundary with a skeleton. After each route change focus moves to <main>, so
 * keyboard and screen-reader users start at the new page.
 */
export function AppShell() {
  const { pathname } = useLocation();
  // The drawer remembers the path it was opened on; navigating anywhere else closes it.
  const [drawerOpenedOn, setDrawerOpenedOn] = useState(null);
  if (drawerOpenedOn !== null && drawerOpenedOn !== pathname) setDrawerOpenedOn(null);
  const isDrawerOpen = drawerOpenedOn !== null;
  const openDrawer = () => setDrawerOpenedOn(pathname);
  const closeDrawer = useCallback(() => setDrawerOpenedOn(null), []);

  const mainRef = useRef(null);
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    mainRef.current?.focus();
  }, [pathname]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isDrawerOpen, closeDrawer]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault(); // a hash change would leave '#main' in the URL
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {isDrawerOpen && (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
        />
      )}
      <Sidebar id={SIDEBAR_ID} isOpen={isDrawerOpen} onClose={closeDrawer} />

      <div className="lg:pl-64">
        <Topbar isMenuOpen={isDrawerOpen} menuId={SIDEBAR_ID} onMenuClick={openDrawer} />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
