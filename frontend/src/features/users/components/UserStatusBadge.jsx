import { Badge } from '../../../components/ui/Badge';

/** `Active` (green) or `Deactivated` (gray) badge for any row that has an `isActive` flag. */
export function UserStatusBadge({ isActive }) {
  return <Badge tone={isActive ? 'green' : 'gray'}>{isActive ? 'Active' : 'Deactivated'}</Badge>;
}
