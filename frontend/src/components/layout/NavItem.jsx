import { ExternalLink } from 'lucide-react';
import { NavLink } from 'react-router';
import { cx } from '../../utils/cx';

const BASE = 'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors';
const IDLE = 'text-gray-700 hover:bg-gray-100';
const ACTIVE = 'bg-brand-50 text-brand-700';

/**
 * One sidebar entry, in three flavours that look the same:
 *   to      in-app link; highlighted (and aria-current="page") on its route, exact match with `end`
 *   href    external link, opened in a new tab
 *   neither a button that calls `onClick`
 * @param {object} props
 * @param {import('react').ElementType} props.icon lucide icon
 */
export function NavItem({ to, href, end, icon: Icon, onClick, children }) {
  const content = (
    <>
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {children}
    </>
  );

  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) => cx(BASE, isActive ? ACTIVE : IDLE)}
      >
        {content}
      </NavLink>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cx(BASE, IDLE)}>
        {content}
        <ExternalLink className="ml-auto size-4 opacity-60" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cx(BASE, IDLE)}>
      {content}
    </button>
  );
}
