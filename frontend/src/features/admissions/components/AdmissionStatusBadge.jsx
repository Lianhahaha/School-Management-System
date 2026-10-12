import { Badge } from '../../../components/ui/Badge';
import { ADMISSION_STATUS_LABELS } from '../../../constants/ui';

/**
 * Where an application stands, as a tag: "Waiting to pick a class" while pending, "Admitted · Grade 7 - A"
 * once enrolled. Renders nothing for a student without an application (created by an admin), nor
 * for one declined in the past (nothing declines an application any more).
 *
 * @param {object} props
 * @param {{ admission: object|null, currentEnrollment: object|null }} props.student
 */
export function AdmissionStatusBadge({ student }) {
  const { admission } = student;
  if (admission?.status === 'pending') return <Badge tone="cream">{ADMISSION_STATUS_LABELS.pending}</Badge>;
  if (admission?.status === 'admitted') {
    const className = student.currentEnrollment?.className;
    return (
      <Badge tone="blue">
        {className ? `${ADMISSION_STATUS_LABELS.admitted} · ${className}` : ADMISSION_STATUS_LABELS.admitted}
      </Badge>
    );
  }
  return null;
}
