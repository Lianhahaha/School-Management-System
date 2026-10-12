import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Meter } from '../../../components/ui/Meter';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cx } from '../../../utils/cx';
import { countOf } from '../../../utils/format';
import { formatPercentage, groupBy, passMarkOf } from '../../../utils/grades';
import { useAllGrades, useSemesterSummaries } from '../hooks';

/** A move of less than this many points from the first result to the latest reads as steady. */
const STEADY_WITHIN = 3;

/** "Going up, 6 points since the first" with an arrow; "First result" for one result. */
function Direction({ first, latest, count }) {
  if (count < 2) return <p className="mt-2 text-xs text-gray-600">First result</p>;
  const change = Math.round((latest - first) * 10) / 10;
  let Icon = Minus;
  let word = 'Steady';
  if (change >= STEADY_WITHIN) [Icon, word] = [TrendingUp, 'Going up'];
  if (change <= -STEADY_WITHIN) [Icon, word] = [TrendingDown, 'Going down'];
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-gray-700">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">{word}</span>
        {change !== 0 && `, ${change > 0 ? '+' : '−'}${Math.abs(change)} pts since the first`}
      </span>
    </p>
  );
}

/**
 * One student's results over time, a row per subject: the latest graded assessment's percentage, which way
 * the results are going since the first, and the results drawn against the passing mark (60 % in K-12
 * subjects, 75 % otherwise). Fetches its own data (every page of GET /grades), so the admin's student page and
 * the student's own page share it; on the student's page it is the same request as GradesBySubject, so both
 * share one cached answer.
 *
 * @param {object} props
 * @param {number} [props.studentId] the student; omit for the signed-in student
 * @param {string} [props.academicYear] one school year (default: every year)
 * @param {string} [props.semester] 'sem1' or 'sem2' to restrict it to one semester (default: both)
 */
export function GradeTrendCard({ studentId, academicYear, semester }) {
  const { data, error, isPending, refetch } = useAllGrades({
    studentId,
    academicYear,
    semester,
    sortBy: 'assessedOn',
    sortOrder: 'desc',
  });
  // The same requests as GradeSummaryPanel's beside it; only the grading method of each subject is used. The
  // card waits for them too: without the method a K-12 subject's passing mark would sit at 75% instead of 60%.
  const summary = useSemesterSummaries({ studentId, academicYear, semester });
  const methodOf = (classSubjectId) =>
    summary.data.find((row) => row.classSubjectId === classSubjectId)?.method;

  const failed = error ?? summary.error;
  if (failed) {
    const retry = () => Promise.all([refetch(), summary.refetch()]);
    return <ErrorState title="Couldn't load results" message={failed.message} onRetry={retry} />;
  }
  if (isPending || summary.isPending) return <Skeleton className="h-40 w-full" />;
  if (data.length === 0) return null;

  // Oldest first, one group per subject (class-subject), subjects in the order of their first result.
  const subjects = [...groupBy([...data].reverse(), (grade) => grade.assessment.classSubjectId).values()];
  return (
    <Card
      title="Results over time"
      description="The latest result in each subject and which way the results are going. The short upright line on each bar is the passing mark: 60% in K-12 subjects, 75% in others."
    >
      <ul className="divide-y divide-gray-200">
        {subjects.map((grades) => {
          const { subjectName, className } = grades.at(-1).assessment;
          const latest = grades.at(-1);
          const passMark = passMarkOf(methodOf(latest.assessment.classSubjectId));
          const below = latest.percentage < passMark;
          return (
            <li key={latest.assessment.classSubjectId} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{subjectName}</p>
                  <p className="text-xs text-gray-600">
                    {className} · {countOf(grades.length, 'result')} · passing {passMark}%
                  </p>
                </div>
                <p
                  className={cx(
                    'shrink-0 text-lg font-semibold tabular-nums',
                    below ? 'text-attention-ink' : 'text-gray-900',
                  )}
                >
                  {formatPercentage(latest.percentage)}
                </p>
              </div>
              <Meter value={latest.percentage} goal={passMark} className="mt-2.5" />
              <Direction first={grades[0].percentage} latest={latest.percentage} count={grades.length} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
