import { Badge } from '../../../components/ui/Badge';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_TONES } from '../../../constants/ui';

/** Attendance status as a labelled badge ("Present", "Absent", ...); `null` (not marked) renders "Not marked". */
export function AttendanceStatusBadge({ status }) {
  if (!status) return <Badge tone="gray">Not marked</Badge>;
  return <Badge tone={ATTENDANCE_STATUS_TONES[status]}>{ATTENDANCE_STATUS_LABELS[status]}</Badge>;
}
