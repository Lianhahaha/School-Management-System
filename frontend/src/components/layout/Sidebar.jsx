import { BookText, LogOut, User, X } from 'lucide-react';
import { env } from '../../config/env';
import { useAuth } from '../../features/auth/hooks';
import { cx } from '../../utils/cx';
import { Brand } from './Brand';
import { NAV } from './navConfig';
import { NavItem } from './NavItem';

/**
 * Left navigation: the current role's entries from navConfig, then API docs, Profile and Sign out.
 * A fixed column from the `lg` breakpoint up; below it an off-canvas drawer that AppShell opens.
 * While the drawer is closed it is `invisible`, which also removes its links from the tab order.
 *
 * @param {object} props
 * @param {string} props.id referenced by the hamburger's aria-controls
 * @param {boolean} props.isOpen drawer state (ignored from `lg` up)
 * @param {() => void} props.onClose closes the drawer; also called after every navigation click
 */
export function Sidebar({ id, isOpen, onClose }) {
  const { role, logout } = useAuth();

  return (
    <aside
      id={id}
      className={cx(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-[transform,visibility] lg:visible lg:translate-x-0',
        isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-4">
        <Brand />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="-mr-2 flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV[role].map(({ label, to, icon, end }) => (
            <li key={to}>
              <NavItem to={to} end={end} icon={icon} onClick={onClose}>
                {label}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="shrink-0 space-y-1 border-t border-gray-200 p-3">
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
