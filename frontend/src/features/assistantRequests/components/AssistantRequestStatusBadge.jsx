import { Badge } from '../../../components/ui/Badge';
import { ASSISTANT_REQUEST_STATUS_LABELS, ASSISTANT_REQUEST_STATUS_TONES } from '../../../constants/ui';

/**
 * Where a student assistant's sign-up stands, as a squared tag: Pending, Approved or Declined.
 * @param {{ status: 'pending' | 'approved' | 'declined' }} props
 */
export function AssistantRequestStatusBadge({ status }) {
  return (
    <Badge tone={ASSISTANT_REQUEST_STATUS_TONES[status]}>
      {ASSISTANT_REQUEST_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
