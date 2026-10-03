import { Badge } from '../../../components/ui/Badge';
import { roleLabel, roleTone } from '../../../utils/roles';

/** Badge with a role's label and colour: admin violet, teacher blue, student green. */
export function RoleBadge({ role }) {
  return <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>;
}
