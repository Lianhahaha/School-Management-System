import { ChevronDown, Download, LogOut, User } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { fullName, initials } from '../../utils/names';
import { roleLabel } from '../../utils/roles';
import { Dropdown } from '../ui/Dropdown';

/**
 * Account menu in the top bar: the user's name and role, with Profile and Sign out, and "Install app"
 * while the browser offers to install Skole.
 */
export function UserMenu() {
  const { me, logout } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const name = fullName(me);

  return (
    <Dropdown
      label={`${name}, account menu`}
      align="right"
      className="max-lg:px-0"
      trigger={
        <>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-gray-50"
          >
            {initials(me)}
          </span>
          <span className="hidden text-left lg:block">
            <span className="block text-sm leading-tight font-medium text-gray-900">{name}</span>
            <span className="block text-xs leading-tight text-gray-500">{roleLabel(me.role)}</span>
          </span>
          <ChevronDown className="size-4 text-gray-500 max-lg:hidden" aria-hidden="true" />
        </>
      }
      items={[
        { label: 'Profile', to: '/profile', icon: User },
        ...(canInstall ? [{ label: 'Install app', icon: Download, onClick: install }] : []),
        { label: 'Sign out', icon: LogOut, onClick: logout },
      ]}
    />
  );
}
