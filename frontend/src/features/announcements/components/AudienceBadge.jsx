import { Badge } from '../../../components/ui/Badge';
import { ANNOUNCEMENT_AUDIENCE_LABELS } from '../../../constants/ui';

const AUDIENCE_TONES = { all: 'blue', students: 'blue', teachers: 'violet' };

/** Who an announcement is for: Everyone, Students or Teachers. */
export function AudienceBadge({ audience }) {
  return (
    <Badge tone={AUDIENCE_TONES[audience] ?? 'gray'}>
      {ANNOUNCEMENT_AUDIENCE_LABELS[audience] ?? audience}
    </Badge>
  );
}
