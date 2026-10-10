import { FileCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { formatDate, isoToYmd } from '../../../utils/date';
import { AdmissionStatusBadge } from './AdmissionStatusBadge';
import { DeclineApplicationModal } from './DeclineApplicationModal';
import { DocumentChecklist } from './DocumentChecklist';

/**
 * The application of a self-registered student, on their page (admin): the grade applied for, the previous
 * school, where it stands, the document checklist and, while it is pending, Decline. Admitting is the page's
 * Enroll button.
 *
 * @param {object} props
 * @param {object} props.student GET /students/:id data, with `admission`
 */
export function ApplicationCard({ student }) {
  const [declineTarget, setDeclineTarget] = useState(null);
  const { admission } = student;
  const isPending = admission.status === 'pending';

  return (
    <Card
      title="Application"
      icon={FileCheck}
      mark="maroon"
      actions={<AdmissionStatusBadge student={student} />}
    >
      <DescriptionList
        items={[
          { label: 'Grade applied for', value: `Grade ${admission.gradeLevel}` },
          { label: 'Previous school', value: admission.previousSchool },
          { label: 'Applied', value: formatDate(isoToYmd(admission.appliedAt)) },
          ...(admission.declineReason ? [{ label: 'Reason declined', value: admission.declineReason }] : []),
        ]}
      />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-4">
        <div>
          <p className="mb-2 text-sm text-gray-500">Documents received</p>
          <DocumentChecklist student={student} />
        </div>
        {isPending && (
          <Button variant="dangerGhost" size="sm" onClick={() => setDeclineTarget(student)}>
            Decline
          </Button>
        )}
      </div>
      <DeclineApplicationModal student={declineTarget} onClose={() => setDeclineTarget(null)} />
    </Card>
  );
}
