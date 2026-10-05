import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TrendChart } from '../../../components/ui/TrendChart';
import { formatDate } from '../../../utils/date';
import { countOf } from '../../../utils/format';
import { formatResult, groupBy } from '../../../utils/grades';
import { useGrades } from '../hooks';

/** Same request as GradesBySubject, so on the student's own page both share one cached answer. */
const MAX_ROWS = 100;

/** The usual passing mark, drawn as a dashed line. */
const PASS_MARK = 75;

/** "+6 pts since the first" / "−4 pts since the first" / "same as the first", in percentage points. */
function changeText(first, latest) {
  const change = Math.round((latest - first) * 10) / 10;
  if (change === 0) return 'same as the first';
  return `${change > 0 ? '+' : '−'}${Math.abs(change)} pts since the first`;
}

/**
 * One student's results over time: per subject, a small line of each graded assessment's percentage, oldest
 * to newest, with the 75 % line dashed, the latest result and how far it moved since the first. Fetches its
 * own data (GET /grades, the newest 100), so the admin's student page and the student's own page share it.
 *
 * @param {object} props
 * @param {number} [props.studentId] the student; omit for the signed-in student
 * @param {string} [props.term] 'term1' | 'term2' | 'term3' to restrict it (default: all terms)
 */
export function GradeTrendCard({ studentId, term }) {
  const { data, error, isPending, refetch } = useGrades({
    studentId,
    term,
    limit: MAX_ROWS,
    sortBy: 'assessedOn',
    sortOrder: 'desc',
  });

  if (error) return <ErrorState title="Couldn't load results" message={error.message} onRetry={refetch} />;
  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (data.items.length === 0) return null;

  // Oldest first, one group per subject (class-subject), subjects in the order of their first result.
  const subjects = [
    ...groupBy([...data.items].reverse(), (grade) => grade.assessment.classSubjectId).values(),
  ];

  return (
    <Card title="Results over time" description="Each graded assessment, oldest to newest. Dashed line: 75%.">
      <ul className="divide-y divide-gray-200">
        {subjects.map((grades) => {
          const { subjectName, className } = grades[0].assessment;
          const latest = grades.at(-1);
          return (
            <li
              key={latest.assessment.classSubjectId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{subjectName}</p>
                <p className="truncate text-xs text-gray-600">
                  {className} · {countOf(grades.length, 'result')}
                </p>
              </div>
              <TrendChart
                compact
                height={44}
                label={`${subjectName} results`}
                points={grades.map((grade) => ({
                  label: `${grade.assessment.title}, ${formatDate(grade.assessment.assessedOn)}`,
                  value: grade.percentage,
                }))}
                threshold={PASS_MARK}
                formatValue={formatResult}
                className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
              />
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatResult(latest.percentage)}
                </p>
                <p className="text-xs text-gray-600">
                  {grades.length > 1 ? changeText(grades[0].percentage, latest.percentage) : 'first result'}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {data.meta.total > MAX_ROWS && (
        <p className="mt-3 text-xs text-gray-600">Based on the {MAX_ROWS} most recent grades.</p>
      )}
    </Card>
  );
}
