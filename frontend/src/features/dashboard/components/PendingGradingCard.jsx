import { Award, CircleCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../utils/date';

/** Assessments with students still to grade (payload `pendingGrading`); each row opens its grade sheet. */
export function PendingGradingCard({ assessments }) {
  return (
    <Card
      icon={Award}
      mark="cream"
      title="Pending grading"
      actions={
        <Button as={Link} to="/teacher/grades" variant="secondary" size="sm">
          Create assessment
        </Button>
      }
    >
      {assessments.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Nothing to grade" compact />
      ) : (
        <ul className="divide-y divide-gray-200">
          {assessments.map((assessment) => (
            <li key={assessment.assessmentId} className="py-3 first:pt-0 last:pb-0">
              <Link
                to={`/teacher/grades/assessments/${assessment.assessmentId}`}
                className="-mx-3 block rounded-2xl px-3 py-2 transition-colors hover:bg-gray-100"
              >
                <p className="text-sm font-medium text-gray-900">{assessment.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {assessment.className} · {assessment.subjectName} · {formatDate(assessment.assessedOn)}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {assessment.graded}/{assessment.enrolled} graded
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
