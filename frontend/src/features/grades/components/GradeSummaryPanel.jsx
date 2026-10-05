import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatScore } from '../../../utils/format';
import { describeWeights, formatResult, resultWidth } from '../../../utils/grades';
import { useGradeSummary } from '../hooks';

/** How the result was reached: the subject's weights, or the points. */
function resultBasis(subject) {
  const graded = `${subject.assessmentsGraded} graded`;
  if (subject.method === 'weighted') return `Weighted: ${describeWeights(subject.gradeWeights)} · ${graded}`;
  return `${formatScore(subject.totalScore, subject.totalMaxScore)} points · ${graded}`;
}

/**
 * Grades of one student: a card per class-subject (newest academic year first) with its result as a bar and
 * text. The result is on points (sum of scores / sum of max scores over graded assessments) or uses the
 * subject's weights per assessment type; the card says which.
 * Fetches its own data, so the admin's student page and the student's own pages use the same panel.
 *
 * @param {object} props
 * @param {number|string} props.studentId a student id, or 'me' for the signed-in student
 * @param {string} [props.term] 'term1' | 'term2' | 'term3' to restrict the summary (default: all terms)
 * @param {boolean} [props.enabled] set false to hold the request, for example while a student has no class yet
 */
export function GradeSummaryPanel({ studentId, term, enabled = true }) {
  const { data, error, isPending, refetch } = useGradeSummary(
    { studentId, term, groupBy: 'classSubject' },
    { enabled },
  );

  if (error) return <ErrorState title="Couldn't load grades" message={error.message} onRetry={refetch} />;
  if (isPending) return <Skeleton className="h-28 w-full" />;
  if (data.length === 0) {
    return <EmptyState title="No grades recorded" description="Graded assessments will appear here." />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((subject) => (
        <li key={subject.classSubjectId}>
          <Card className="h-full">
            <h3 className="text-sm font-semibold text-gray-900">{subject.subjectName}</h3>
            <p className="text-xs text-gray-600">
              {subject.className} · {subject.academicYear}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatResult(subject.percentage)}</p>
            <div
              role="progressbar"
              aria-label={`${subject.subjectName}, ${subject.className} percentage`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={subject.percentage ?? undefined}
              className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className="h-full rounded-full bg-gray-900"
                style={{ width: resultWidth(subject.percentage) }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">{resultBasis(subject)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
