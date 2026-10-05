import { GraduationCap } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate, todayYmd } from '../../../utils/date';
import { countOf, formatPercent, formatScore } from '../../../utils/format';
import { groupBy } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { useAssessments, useGrades } from '../hooks';
import { GradeSummaryPanel } from './GradeSummaryPanel';
import { GradeTrendCard } from './GradeTrendCard';

const MAX_ROWS = 100;

const COLUMNS = [
  {
    key: 'title',
    header: 'Assessment',
    cell: (row) => <span className="font-medium text-gray-900">{row.assessment.title}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    hideBelow: 'sm',
    cell: (row) => <Badge tone="gray">{ASSESSMENT_TYPE_LABELS[row.assessment.type]}</Badge>,
  },
  {
    key: 'assessedOn',
    header: 'Date',
    cell: (row) => <time dateTime={row.assessment.assessedOn}>{formatDate(row.assessment.assessedOn)}</time>,
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    cell: (row) => formatScore(row.score, row.assessment.maxScore),
  },
  {
    key: 'percentage',
    header: 'Percent',
    align: 'right',
    cell: (row) => formatPercent(row.percentage / 100),
  },
  { key: 'remarks', header: 'Remarks', hideBelow: 'md', cell: (row) => row.remarks ?? '—' },
  { key: 'gradedBy', header: 'Graded by', hideBelow: 'lg', cell: (row) => fullName(row.gradedBy) },
];

/**
 * The signed-in student's grades: the per-subject percentage cards (GradeSummaryPanel) and, per subject,
 * the recorded grades with the next upcoming assessment. One GET /grades call, grouped client-side.
 * Only call it for an enrolled student.
 *
 * @param {object} props
 * @param {string} [props.term] 'term1' | 'term2' | 'term3'; omit for all terms
 */
export function GradesBySubject({ term }) {
  const grades = useGrades({ term, limit: MAX_ROWS, sortBy: 'assessedOn', sortOrder: 'desc' });
  const upcoming = useAssessments({
    term,
    dateFrom: todayYmd(),
    sortBy: 'assessedOn',
    sortOrder: 'asc',
    limit: MAX_ROWS,
  });

  if (grades.error) {
    return (
      <ErrorState title="Couldn't load grades" message={grades.error.message} onRetry={grades.refetch} />
    );
  }
  if (grades.isPending) return <Skeleton className="h-40 w-full" />;
  if (grades.data.items.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No grades recorded for this term yet"
        description="Graded assessments will appear here."
      />
    );
  }

  const groups = [...groupBy(grades.data.items, (grade) => grade.assessment.classSubjectId)];
  const nextUp = (classSubjectId) =>
    upcoming.data?.items.find((assessment) => assessment.classSubjectId === classSubjectId);

  return (
    <div className="space-y-6">
      <GradeSummaryPanel studentId="me" term={term} />
      <GradeTrendCard term={term} />
      {groups.map(([classSubjectId, rows]) => {
        const next = nextUp(classSubjectId);
        const { subjectName, className } = rows[0].assessment;
        return (
          <Card
            key={classSubjectId}
            title={subjectName}
            description={`${className} · ${countOf(rows.length, 'grade')}`}
            padded={false}
          >
            <DataTable label={`${subjectName} grades`} columns={COLUMNS} rows={rows} rowKey="id" />
            {next && (
              <p className="border-t border-gray-100 px-5 py-3 text-sm text-gray-600">
                Upcoming: {next.title} · <time dateTime={next.assessedOn}>{formatDate(next.assessedOn)}</time>
              </p>
            )}
          </Card>
        );
      })}
      {grades.data.meta.total > MAX_ROWS && (
        <p className="text-sm text-gray-600">Showing your {MAX_ROWS} most recent grades.</p>
      )}
    </div>
  );
}
