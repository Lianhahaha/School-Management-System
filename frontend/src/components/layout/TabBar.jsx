import { Ellipsis } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { cx } from '../../utils/cx';
import { NAV } from './navConfig';

const ITEM = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium';
const CHIP = 'flex h-8 w-12 items-center justify-center rounded-full transition-colors';

/**
 * Phone navigation (below `lg`): a floating rounded bar with the role's four `tab` entries and
 * "More", which opens the full menu. The current tab's icon sits on the yellow chip.
 * @param {object} props
 * @param {string} props.menuId id of the sidebar, for aria-controls
 * @param {boolean} props.isMenuOpen
 * @param {() => void} props.onMoreClick
 */
export function TabBar({ menuId, isMenuOpen, onMoreClick }) {
  const { role } = useAuth();
  const tabs = NAV[role].filter((entry) => entry.tab);

  return (
    <nav
      id="app-tabbar"
      aria-label="Quick"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-[1.75rem] bg-surface px-1.5 shadow-pop lg:hidden"
    >
      <ul className="flex">
        {tabs.map(({ label, short, to, icon: Icon, end }) => (
          <li key={to} className="flex flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cx(ITEM, isActive ? 'text-gray-900' : 'text-gray-500')}
            >
              {({ isActive }) => (
                <>
                  <span className={cx(CHIP, isActive && 'bg-accent text-accent-ink')}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {short ?? label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onMoreClick}
            aria-controls={menuId}
            aria-expanded={isMenuOpen}
            className={cx(ITEM, 'text-gray-500')}
          >
            <span className={CHIP}>
              <Ellipsis className="size-5" aria-hidden="true" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
