import { ClipboardCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TrendChart } from '../../../components/ui/TrendChart';
import { ATTENDANCE_RATE_LINE } from '../../../constants/ui';
import { formatShortDate } from '../../../utils/date';
import { formatPercent } from '../../../utils/format';
import { useAttendanceSummary } from '../hooks';

/** The line drawn on the chart: the attendance rate the dashboards treat as "needs attention" below it. */
const TARGET_RATE = ATTENDANCE_RATE_LINE * 100;

const formatRate = (value) => formatPercent(value / 100);

/**
 * The attendance rate ((present + late) / marks) week by week, as a line with the 80 % line dashed.
 * Weeks start on Monday and are labelled by that date; weeks without marks are left out. Fetches its own
 * data (GET /attendance/summary with groupBy=week), so a class, a lesson or a student can use it.
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
    const latest = data.at(-1);
    body = (
      <>
        <p className="mb-3 text-sm text-gray-700">
          Week of {formatShortDate(latest.weekStart)}:{' '}
          <span className="font-semibold text-gray-900">{formatPercent(latest.rate)}</span> of {latest.total}{' '}
          marks
        </p>
        <TrendChart
          label="Attendance rate per week"
          points={data.map((week) => ({
            label: formatShortDate(week.weekStart),
            value: week.rate === null ? null : week.rate * 100,
          }))}
          threshold={TARGET_RATE}
          formatValue={formatRate}
        />
        <p className="mt-2 text-xs text-gray-500">
          Dashed line: {TARGET_RATE}%, below which a student needs attention.
        </p>
      </>
    );
  }

  return (
    <Card title="Attendance by week" description={description}>
      {body}
    </Card>
  );
}
