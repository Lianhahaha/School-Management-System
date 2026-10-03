import { ATTENDANCE_STATUSES } from '../../../constants/shared';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_TONES } from '../../../constants/ui';
import { Badge } from '../../../components/ui/Badge';
import { formatPercent } from '../../../utils/format';

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** At least 90 % green, at least 75 % amber, otherwise red; the percentage text is always shown too. */
function ringTone(rate) {
  if (rate === null || rate === undefined) return 'stroke-gray-300';
  if (rate >= 0.9) return 'stroke-green-600';
  if (rate >= 0.75) return 'stroke-amber-500';
  return 'stroke-red-600';
}

function AttendanceRing({ rate }) {
  const hasRate = rate !== null && rate !== undefined;
  const filled = hasRate ? Math.min(Math.max(rate, 0), 1) * RING_CIRCUMFERENCE : 0;
  return (
    <div
      role="img"
      aria-label={hasRate ? `Attendance rate ${formatPercent(rate)}` : 'No attendance rate yet'}
      className="relative size-32 shrink-0"
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-gray-100" />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
          className={ringTone(rate)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-gray-900">
        {formatPercent(rate)}
      </span>
    </div>
  );
}

/**
 * Attendance rate ring with the present / absent / late / excused counts beside it. Used for the
 * school's attendance today (admin) and a student's attendance this year (student).
 *
 * @param {object} props
 * @param {{ rate: number|null, present: number, absent: number, late: number, excused: number }} props.summary
 */
export function AttendanceOverview({ summary }) {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <AttendanceRing rate={summary.rate} />
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:min-w-56">
        {ATTENDANCE_STATUSES.map((status) => (
          <div key={status}>
            <dt>
              <Badge tone={ATTENDANCE_STATUS_TONES[status]}>{ATTENDANCE_STATUS_LABELS[status]}</Badge>
            </dt>
            <dd className="mt-1 text-xl font-semibold text-gray-900">{summary[status]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
