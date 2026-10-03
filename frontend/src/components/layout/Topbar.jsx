import { Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';

/**
 * Top bar: the hamburger that opens the navigation drawer (below `lg`) and the user menu.
 * @param {object} props
 * @param {boolean} props.isMenuOpen state of the drawer, for aria-expanded
 * @param {string} props.menuId id of the sidebar, for aria-controls
 * @param {() => void} props.onMenuClick
 */
export function Topbar({ isMenuOpen, menuId, onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        className="-ml-2 flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
