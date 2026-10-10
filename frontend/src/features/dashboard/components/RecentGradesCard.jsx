import { Award, Medal } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { formatPercent, formatScore } from '../../../utils/format';

/** The student's newest grades (payload `recentGrades`, at most five). */
export function RecentGradesCard({ grades }) {
  return (
    <Card
      icon={Medal}
      mark="cream"
      title="Recent grades"
      actions={<TextLink to="/student/grades">All grades</TextLink>}
    >
      {grades.length === 0 ? (
        <EmptyState icon={Award} title="No grades yet" compact />
      ) : (
        <ul className="divide-y divide-gray-200">
          {grades.map((grade) => (
            <li
              key={grade.gradeId}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{grade.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                  {grade.subjectName}
                  <Badge tone="gray">{ASSESSMENT_TYPE_LABELS[grade.type] ?? grade.type}</Badge>
                  <time dateTime={grade.assessedOn}>{formatDate(grade.assessedOn)}</time>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatScore(grade.score, grade.maxScore)}
                </p>
                <p className="text-xs text-gray-600">{formatPercent(grade.percentage / 100)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
