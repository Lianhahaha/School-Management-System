import { CalendarOff, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { LiveTag } from '../../../components/ui/LiveTag';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cx } from '../../../utils/cx';
import { todayYmd } from '../../../utils/date';
import { timeToMinutes } from '../../../utils/schedule';
import { PeriodTime } from './PeriodTime';

const MINUTE = 60_000;

/** Minutes since midnight, refreshed every minute so the current period highlight follows the clock. */
function useMinutesNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Today's periods of a teacher as a vertical timeline (payload `todaySchedule`). Every period shows
 * a green "Marked" chip or a "Mark now" link to the attendance sheet of that period and day; the
 * period running right now is highlighted.
 */
export function TodayTimeline({ periods }) {
  const minutesNow = useMinutesNow();
  const sorted = [...periods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const date = todayYmd();

  return (
    <Card title="Today's periods">
      {sorted.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No periods today" description="Enjoy the quiet day." compact />
      ) : (
        <ol className="space-y-2">
          {sorted.map((period) => {
            const isCurrent =
              minutesNow >= timeToMinutes(period.startTime) && minutesNow < timeToMinutes(period.endTime);
            return (
              <li
                key={period.scheduleId}
                aria-current={isCurrent ? 'time' : undefined}
                className={cx(
                  'flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] px-4 py-3',
                  isCurrent ? 'bg-accent-soft ring-2 ring-accent-line ring-inset' : 'bg-gray-100',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    <PeriodTime startTime={period.startTime} endTime={period.endTime} />
                    {isCurrent && <LiveTag className="ml-2">Now</LiveTag>}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {period.className} · {period.subjectName}
                    {period.room && ` · ${period.room}`}
                  </p>
                </div>
                {period.attendanceMarked ? (
                  <Badge tone="green" className="gap-1">
                    <Check className="size-3" aria-hidden="true" />
                    Marked
                  </Badge>
                ) : (
                  <Button
                    as={Link}
                    to={`/teacher/attendance?classSubjectId=${period.classSubjectId}&date=${date}`}
                    size="sm"
                    aria-label={`Mark attendance for ${period.className} ${period.subjectName}`}
                  >
                    Mark now
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
