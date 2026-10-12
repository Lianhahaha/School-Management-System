import { ClipboardCheck, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Meter } from '../../../components/ui/Meter';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ATTENDANCE_RATE_LINE } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatShortDate } from '../../../utils/date';
import { formatPercent } from '../../../utils/format';
import { useAttendanceSummary } from '../hooks';

/** The goal: the attendance rate below which the dashboards say a student needs attention. */
const GOAL = ATTENDANCE_RATE_LINE * 100;
/** The weeks listed, newest first. */
const WEEKS_SHOWN = 8;

const isBelowGoal = (week) => week.rate !== null && week.rate * 100 < GOAL;

/** "8 points higher than the week before", with an arrow; nothing for the first week. */
function Change({ latest, previous }) {
  if (!previous || previous.rate === null || latest.rate === null) return null;
  const points = Math.round((latest.rate - previous.rate) * 100);
  const [Icon, text] =
    points === 0
      ? [Minus, 'Same as the week before']
      : [
          points > 0 ? TrendingUp : TrendingDown,
          `${Math.abs(points)} points ${points > 0 ? 'higher' : 'lower'} than the week before`,
        ];
  return (
    <p className="flex items-center gap-1.5 text-sm text-gray-700">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}

/** The newest week in words: its rate, large, and how it moved. */
function Headline({ weeks }) {
  const latest = weeks.at(-1);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
      <p
        className={cx(
          'text-4xl font-semibold tabular-nums',
          isBelowGoal(latest) ? 'text-attention-ink' : 'text-gray-900',
        )}
      >
        {latest.rate === null ? '—' : formatPercent(latest.rate)}
      </p>
      <div className="min-w-0">
        <p className="text-sm text-gray-900">
          attended in the week of {formatShortDate(latest.weekStart)}
          <span className="text-gray-600">
            {' '}
            · {latest.present + latest.late} of {latest.total} marks
          </span>
        </p>
        <Change latest={latest} previous={weeks.at(-2)} />
      </div>
    </div>
  );
}

/**
 * The attendance rate ((present + late) / marks) week by week: the newest week in words, then the latest
 * weeks as rows, newest first, each a filled bar with the 80 % goal marked on it and the rate written beside it
 * (oxblood below the goal). Weeks start on Monday and are labelled by that date; weeks without marks are left
 * out. Fetches its own data (GET /attendance/summary with groupBy=week), so a class, a lesson or a student
 * can use it.
 *
 * @param {object} props
 * @param {object} props.filters summary filters: classId, classSubjectId or studentId ('me'), dateFrom, dateTo
 * @param {string} [props.description] what the weeks cover
 * @param {boolean} [props.enabled]
 */
export function AttendanceTrendCard({ filters, description, enabled = true }) {
  const { data, error, isPending, refetch } = useAttendanceSummary(
    { ...filters, groupBy: 'week' },
    { enabled },
  );

  let body;
  if (error) {
    body = <ErrorState title="Couldn't load the trend" message={error.message} onRetry={refetch} />;
  } else if (isPending) {
    body = <Skeleton className="h-40 w-full" />;
  } else if (data.length === 0) {
    body = (
      <EmptyState
        icon={ClipboardCheck}
        title="No attendance marked yet"
        description="The weekly rate appears once periods are marked."
        compact
      />
    );
  } else {
    const shown = data.slice(-WEEKS_SHOWN).reverse();
    body = (
      <>
        <Headline weeks={data} />
        <ul className="divide-y divide-gray-200">
          {shown.map((week) => (
            <li
              key={week.weekStart}
              className="grid grid-cols-[7.25rem_minmax(0,1fr)_3.25rem] items-center gap-3 py-2.5"
            >
              <span className="text-sm whitespace-nowrap text-gray-700">
                Week of {formatShortDate(week.weekStart)}
              </span>
              <Meter value={week.rate === null ? null : week.rate * 100} goal={GOAL} />
              <span
                className={cx(
                  'text-right text-sm font-semibold tabular-nums',
                  isBelowGoal(week) ? 'text-attention-ink' : 'text-gray-900',
                )}
              >
                {week.rate === null ? '—' : formatPercent(week.rate)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          {shown.some(isBelowGoal) && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-attention-ink" aria-hidden="true" />
              Below {GOAL}%: needs attention
            </span>
          )}
          <span>
            The short upright line on each bar is the {GOAL}% goal.
            {data.length > WEEKS_SHOWN && ` The last ${WEEKS_SHOWN} of ${data.length} weeks.`}
          </span>
        </div>
      </>
    );
  }

  return (
    <Card title="Attendance by week" description={description}>
      {body}
    </Card>
  );
}
