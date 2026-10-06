import { Award, BookOpen } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { formatResult, resultWidth } from '../../../utils/grades';

/** One row per subject with its result (points or the subject's weights) as a bar (payload `gradeSummary`). */
export function StudentGradeSummaryCard({ subjects }) {
  return (
    <Card
      icon={BookOpen}
      mark="plum"
      title="Grades by subject"
      actions={<TextLink to="/student/grades">All grades</TextLink>}
    >
      {subjects.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No grades yet"
          description="Graded assessments will appear here."
          compact
        />
      ) : (
        <ul className="space-y-4">
          {subjects.map((subject) => (
            <li key={subject.classSubjectId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-gray-900">{subject.subjectName}</span>
                <span className="text-gray-700 tabular-nums">{formatResult(subject.percentage)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${subject.subjectName} percentage`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={subject.percentage ?? undefined}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
              >
                <div
                  className="h-full rounded-full bg-gray-900"
                  style={{ width: resultWidth(subject.percentage) }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-600">{subject.assessmentsGraded} graded</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
