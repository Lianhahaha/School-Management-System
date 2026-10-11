import { Badge } from '../../../components/ui/Badge';
import { roleLabel, roleTone } from '../../../utils/roles';

/** Badge with a role's label and colour (ROLE_TONES: the office violet, teachers and students blue). */
export function RoleBadge({ role }) {
  return <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>;
}
