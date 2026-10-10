import { Badge } from '../../../components/ui/Badge';

/**
 * Where an application stands, as a tag: while pending, "Waiting for documents" (amber) until both documents
 * are ticked, then "Ready to admit" (green); "Admitted · Grade 7 - A" once enrolled; "Declined". Renders
 * nothing for a student without an application (created by an admin or an import).
 *
 * @param {object} props
 * @param {{ admission: object|null, currentEnrollment: object|null }} props.student
 */
export function AdmissionStatusBadge({ student }) {
  const { admission } = student;
  if (!admission) return null;
  if (admission.status === 'declined') return <Badge tone="gray">Declined</Badge>;
  if (admission.status === 'admitted') {
    const className = student.currentEnrollment?.className;
    return <Badge tone="blue">{className ? `Admitted · ${className}` : 'Admitted'}</Badge>;
  }
  return admission.birthCertificateReceived && admission.reportCardReceived ? (
    <Badge tone="green">Ready to admit</Badge>
  ) : (
    <Badge tone="amber">Waiting for documents</Badge>
  );
}
