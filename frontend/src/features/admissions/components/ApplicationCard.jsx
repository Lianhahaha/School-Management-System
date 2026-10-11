import { FileCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { formatDate, isoToYmd } from '../../../utils/date';
import { AdmissionStatusBadge } from './AdmissionStatusBadge';
import { DocumentChecklist } from './DocumentChecklist';

/**
 * The application of a self-registered student, on their page (the office): the grade applied for, the
 * previous school, where it stands and the document checklist. The student picks their class themselves;
 * the page's Enroll button is the office's way to place them.
 *
 * @param {object} props
 * @param {object} props.student GET /students/:id data, with `admission`
 */
export function ApplicationCard({ student }) {
  const { admission } = student;

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
        ]}
      />
      <div className="mt-5 border-t border-gray-200 pt-4">
        <p className="mb-2 text-sm text-gray-500">Documents received</p>
        <DocumentChecklist student={student} />
      </div>
    </Card>
  );
}
