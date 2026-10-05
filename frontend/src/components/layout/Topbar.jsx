import { useAuth } from '../../features/auth/hooks';
import { SearchButton } from '../../features/search/components/SearchButton';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Brand } from './Brand';
import { UserMenu } from './UserMenu';

/**
 * Top bar: the wordmark below `lg` (the sidebar carries it from `lg` up), the admin's search, the
 * theme switch and the user menu. On phones the full menu opens from the tab bar's "More".
 */
export function Topbar() {
  const { role } = useAuth();

  return (
    <header
      id="app-topbar"
      className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-10"
    >
      <Brand className="lg:hidden" />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {role === 'admin' && <SearchButton />}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
