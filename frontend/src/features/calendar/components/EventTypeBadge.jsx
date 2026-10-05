import { Badge } from '../../../components/ui/Badge';
import { CALENDAR_EVENT_TYPE_LABELS, CALENDAR_EVENT_TYPE_TONES } from '../../../constants/ui';

/** The kind of a calendar entry as a tag: "No classes" (amber) or "School event". */
export function EventTypeBadge({ type }) {
  return <Badge tone={CALENDAR_EVENT_TYPE_TONES[type]}>{CALENDAR_EVENT_TYPE_LABELS[type]}</Badge>;
}
