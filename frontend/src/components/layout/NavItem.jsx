import { ExternalLink } from 'lucide-react';
import { NavLink } from 'react-router';
import { cx } from '../../utils/cx';
import { NavBadge } from './NavBadge';

const BASE = 'flex min-h-11 w-full items-center gap-3 rounded-full px-3.5 text-[0.9375rem] transition-colors';
const IDLE = 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
const ACTIVE = 'font-semibold text-gray-900';

/**
 * One sidebar entry, in three flavours that look the same:
 *   to      in-app link; on its route (aria-current="page", exact match with `end`) the label gets
 *           the yellow highlighter stroke
 *   href    external link, opened in a new tab
 *   neither a button that calls `onClick`
 * @param {object} props
 * @param {import('react').ElementType} props.icon lucide icon
 * @param {{ count: number, label: string }} [props.badge] count shown at the end of an in-app link
 */
export function NavItem({ to, href, end, icon: Icon, badge, onClick, children }) {
  const icon = <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />;

  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) => cx(BASE, isActive ? ACTIVE : IDLE)}
      >
        {({ isActive }) => (
          <>
            {icon}
            <span className={isActive ? 'highlight' : undefined}>{children}</span>
            {badge && <NavBadge count={badge.count} label={badge.label} className="ml-auto" />}
          </>
        )}
      </NavLink>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cx(BASE, IDLE)}>
        {icon}
        {children}
        <ExternalLink className="ml-auto size-4 opacity-60" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cx(BASE, IDLE)}>
      {icon}
      {children}
    </button>
  );
}
