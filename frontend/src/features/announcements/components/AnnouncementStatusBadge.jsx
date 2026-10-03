import { Badge } from '../../../components/ui/Badge';
import { ANNOUNCEMENT_STATUS_LABELS, ANNOUNCEMENT_STATUS_TONES } from '../../../constants/ui';

/** Active / Scheduled / Expired. Cards show it only for the states that are not live. */
export function AnnouncementStatusBadge({ status }) {
  return (
    <Badge tone={ANNOUNCEMENT_STATUS_TONES[status] ?? 'gray'}>
      {ANNOUNCEMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
