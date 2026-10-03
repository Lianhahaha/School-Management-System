import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../../features/auth/hooks';
import { fullName, initials } from '../../utils/names';
import { roleLabel } from '../../utils/roles';
import { Dropdown } from '../ui/Dropdown';

/** Account menu in the top bar: the user's name and role, with Profile and Sign out. */
export function UserMenu() {
  const { me, logout } = useAuth();
  const name = fullName(me);

  return (
    <Dropdown
      label={`${name}, account menu`}
      align="right"
      trigger={
        <>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-gray-50"
          >
            {initials(me)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm leading-tight font-medium text-gray-900">{name}</span>
            <span className="block text-xs leading-tight text-gray-500">{roleLabel(me.role)}</span>
          </span>
          <ChevronDown className="size-4 text-gray-500" aria-hidden="true" />
        </>
      }
      items={[
        { label: 'Profile', to: '/profile', icon: User },
        { label: 'Sign out', icon: LogOut, onClick: logout },
      ]}
    />
  );
}
