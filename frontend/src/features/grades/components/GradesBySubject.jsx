import { GraduationCap } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate, todayYmd } from '../../../utils/date';
import { countOf, formatPercent, formatScore } from '../../../utils/format';
import { groupBy } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { useAllGrades, useAssessments } from '../hooks';
import { GradeSummaryPanel } from './GradeSummaryPanel';
import { GradeTrendCard } from './GradeTrendCard';
import { NotEnrolledState, NotInClassNote } from '../../enrollments/components/NotEnrolledState';

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
 * The signed-in student's grades of one school year: the per-subject percentage cards (GradeSummaryPanel)
 * and, per subject, the recorded grades with the next upcoming assessment. Every grade of the year is loaded
 * (all pages of GET /grades) and grouped client-side. A student who is not in a class (`notEnrolled`) still
 * sees the grades of earlier classes, under a note; with no grades at all they get the not-enrolled state.
 *
 * @param {object} props
 * @param {string} props.academicYear the school year shown
 * @param {string} [props.term] 'term1' | 'term2' | 'term3'; omit for the whole year
 * @param {boolean} [props.notEnrolled] the student has no active enrollment
 * @param {boolean} [props.withUpcoming] show upcoming assessments (only the current class has any)
 */
export function GradesBySubject({ academicYear, term, notEnrolled = false, withUpcoming = false }) {
  const grades = useAllGrades({ academicYear, term, sortBy: 'assessedOn', sortOrder: 'desc' });
  const upcoming = useAssessments(
    { term, dateFrom: todayYmd(), sortBy: 'assessedOn', sortOrder: 'asc', limit: PAGINATION.MAX_LIMIT },
    { enabled: withUpcoming },
  );

  if (grades.error) {
    return (
      <ErrorState title="Couldn't load grades" message={grades.error.message} onRetry={grades.refetch} />
    );
  }
  if (grades.isPending) return <Skeleton className="h-40 w-full" />;
  if (grades.data.length === 0 && notEnrolled && !term) return <NotEnrolledState />;
  if (grades.data.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={
          term ? 'No grades recorded for this semester yet' : 'No grades recorded for this school year yet'
        }
        description="Graded assessments will appear here."
      />
    );
  }

  const groups = [...groupBy(grades.data, (grade) => grade.assessment.classSubjectId)];
  const nextUp = (classSubjectId) =>
    withUpcoming
      ? upcoming.data?.items.find((assessment) => assessment.classSubjectId === classSubjectId)
      : undefined;

  return (
    <div className="space-y-6">
      {notEnrolled && (
        <NotInClassNote>
          You're not in a class right now. These are your grades from earlier classes.
        </NotInClassNote>
      )}
      <GradeSummaryPanel studentId="me" academicYear={academicYear} term={term} />
      <GradeTrendCard academicYear={academicYear} term={term} />
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
    </div>
  );
}
