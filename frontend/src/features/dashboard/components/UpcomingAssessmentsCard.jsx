import { CalendarClock, ClipboardCheck } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';

/**
 * Assessments coming up in the next seven days (dashboard payload `upcomingAssessments`, the first few, and
 * `upcomingAssessmentsTotal`, how many there are in all). Shown on the admin and the student dashboard.
 * @param {object} props
 * @param {object[]} props.assessments soonest first
 * @param {number} props.total every upcoming assessment, also those not listed
 */
export function UpcomingAssessmentsCard({ assessments, total }) {
  return (
    <Card
      icon={ClipboardCheck}
      mark="cream"
      title="Upcoming assessments"
      total={total > 0 ? total : undefined}
      description="In the next 7 days"
    >
      {assessments.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing coming up" compact />
      ) : (
        <ul className="divide-y divide-gray-200">
          {assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{assessment.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {assessment.className} · {assessment.subjectName}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <time dateTime={assessment.assessedOn} className="text-sm text-gray-700">
                  {formatDate(assessment.assessedOn)}
                </time>
                <Badge tone="gray">{ASSESSMENT_TYPE_LABELS[assessment.type] ?? assessment.type}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
      {assessments.length < total && (
        <p className="mt-3 text-xs text-gray-600">
          Showing the next {assessments.length} of {total}.
        </p>
      )}
    </Card>
  );
}
