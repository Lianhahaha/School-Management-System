import { BookText, LogOut, User, X } from 'lucide-react';
import { env } from '../../config/env';
import { useAuth } from '../../features/auth/hooks';
import { cx } from '../../utils/cx';
import { Brand } from './Brand';
import { NAV } from './navConfig';
import { NavItem } from './NavItem';

/**
 * Left navigation: the current role's entries from navConfig, then API docs, Profile and Sign out.
 * From `lg` up it is part of the page (same grey as the page, no frame); below `lg` it is an
 * off-canvas sheet that the phone tab bar's "More" opens.
 * While the drawer is closed it is `invisible`, which also removes its links from the tab order.
 *
 * @param {object} props
 * @param {string} props.id referenced by the opener's aria-controls
 * @param {boolean} props.isOpen drawer state (ignored from `lg` up)
 * @param {() => void} props.onClose closes the drawer; also called after every navigation click
 */
export function Sidebar({ id, isOpen, onClose }) {
  const { role, logout } = useAuth();

  return (
    <aside
      id={id}
      className={cx(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-pop transition-[transform,visibility] duration-200 ease-out-soft',
        'lg:visible lg:w-64 lg:translate-x-0 lg:bg-canvas lg:shadow-none',
        isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Brand />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="-mr-2 flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 lg:hidden"
        >
          <X className="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV[role].map(({ label, to, icon, end }) => (
            <li key={to}>
              <NavItem to={to} end={end} icon={icon} onClick={onClose}>
                {label}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="shrink-0 space-y-0.5 px-3 pt-2 pb-5">
        <li>
          <NavItem href={env.apiDocsUrl} icon={BookText}>
            API docs
          </NavItem>
        </li>
        <li>
          <NavItem to="/profile" icon={User} onClick={onClose}>
            Profile
          </NavItem>
        </li>
        <li>
          <NavItem icon={LogOut} onClick={logout}>
            Sign out
          </NavItem>
        </li>
      </ul>
    </aside>
  );
}
