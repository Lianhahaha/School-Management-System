import { Badge } from '../../../components/ui/Badge';

/** `Active` (green) or `Disabled` (gray) badge for any row that has an `isActive` flag. */
export function UserStatusBadge({ isActive }) {
  return <Badge tone={isActive ? 'green' : 'gray'}>{isActive ? 'Active' : 'Disabled'}</Badge>;
}
