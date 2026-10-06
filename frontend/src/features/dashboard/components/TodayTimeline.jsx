import { CalendarOff, Check, Clock } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { LiveTag } from '../../../components/ui/LiveTag';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useMinutesNow } from '../../../hooks/useMinutesNow';
import { cx } from '../../../utils/cx';
import { todayYmd } from '../../../utils/date';
import { timeToMinutes } from '../../../utils/schedule';
import { PeriodTime } from './PeriodTime';

/**
 * Today's periods of a teacher as a vertical timeline (payload `todaySchedule`). Every period shows
 * a green "Marked" chip or a "Mark" link to the attendance sheet of that period and day; the period running
 * right now is highlighted. The links are grey: the page's one yellow button ("Mark attendance" in the
 * header) already goes to the lesson to mark next. On a school holiday (`holiday`, payload `holidayToday`)
 * the API sends no periods and the card names the holiday.
 */
export function TodayTimeline({ periods, holiday }) {
  const minutesNow = useMinutesNow();
  const sorted = [...periods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const date = todayYmd();

  return (
    <Card icon={Clock} mark="umber" title="Today's periods">
      {holiday ? (
        <EmptyState
          icon={CalendarOff}
          title={`No classes today: ${holiday.title}`}
          description="No lessons and no attendance to mark."
          compact
        />
      ) : sorted.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No periods today" compact />
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
                    variant="secondary"
                    size="sm"
                    aria-label={`Mark, ${period.className} ${period.subjectName} at ${period.startTime}`}
                  >
                    Mark
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
