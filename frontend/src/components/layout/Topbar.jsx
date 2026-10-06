import { useAuth } from '../../features/auth/hooks';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';
import { SearchButton } from '../../features/search/components/SearchButton';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Brand } from './Brand';
import { LastUpdated } from './LastUpdated';
import { UserMenu } from './UserMenu';

/**
 * Top bar: the wordmark below `lg` (the sidebar carries it from `lg` up), when the data was last
 * refreshed (from `md` up), the admin's search, the notification bell, the theme switch and the user menu. On phones the full menu opens from the tab bar's "More".
 * Below `sm` the controls shrink to 44 px squares (no user name, no chevron) so the bar fits a 320 px
 * screen, and below 22rem only the mark of the brand is shown.
 */
export function Topbar() {
  const { role } = useAuth();

  return (
    <header
      id="app-topbar"
      className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-10"
    >
      <Brand className="lg:hidden" wordmarkClassName="max-[22rem]:hidden" />
      <LastUpdated className="max-md:hidden lg:-ml-2" />
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        {role === 'admin' && <SearchButton />}
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
