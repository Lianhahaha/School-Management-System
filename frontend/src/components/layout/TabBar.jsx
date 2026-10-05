import { Ellipsis } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '../../features/auth/hooks';
import { cx } from '../../utils/cx';
import { NavBadge } from './NavBadge';
import { NAV } from './navConfig';
import { useNavBadges } from './useNavBadges';

const ITEM = 'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium';
// The label never runs into its neighbour: a step smaller and tighter on the narrowest phones, cut with … as a last resort.
const LABEL = 'max-w-full truncate px-0.5 max-[22.5rem]:px-0 max-[22.5rem]:text-[0.6875rem] max-[22.5rem]:tracking-tight';
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
  const badges = useNavBadges();

  return (
    <nav
      id="app-tabbar"
      aria-label="Quick"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-[1.75rem] bg-surface px-1.5 shadow-pop lg:hidden"
    >
      <ul className="flex">
        {tabs.map(({ label, short, to, icon: Icon, end, badge }) => (
          <li key={to} className="flex flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cx(ITEM, isActive ? 'text-gray-900' : 'text-gray-500')}
            >
              {({ isActive }) => (
                <>
                  <span className={cx(CHIP, 'relative', isActive && 'bg-accent text-accent-ink')}>
                    <Icon className="size-5" aria-hidden="true" />
                    {badge && badges[badge] && (
                      <NavBadge
                        count={badges[badge].count}
                        label={badges[badge].label}
                        className="absolute -top-1 -right-1 min-w-4 px-1 text-[0.625rem] leading-4 ring-2 ring-surface"
                      />
                    )}
                  </span>
                  <span className={LABEL}>{short ?? label}</span>
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
            <span className={LABEL}>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
