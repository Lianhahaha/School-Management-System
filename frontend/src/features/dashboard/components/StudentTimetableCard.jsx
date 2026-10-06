import { CalendarOff, Clock } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { fullName } from '../../../utils/names';
import { timeToMinutes } from '../../../utils/schedule';
import { PeriodTime } from './PeriodTime';

/** The student's lessons of today (payload `todaySchedule`) as a compact list. */
export function StudentTimetableCard({ periods }) {
  const sorted = [...periods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  return (
    <Card
      icon={Clock}
      mark="umber"
      title="Today's timetable"
      actions={<TextLink to="/student/schedule">Full week</TextLink>}
    >
      {sorted.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No classes today" compact />
      ) : (
        <ol className="divide-y divide-gray-200">
          {sorted.map((period) => (
            <li key={period.scheduleId} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
              <PeriodTime
                startTime={period.startTime}
                endTime={period.endTime}
                className="w-28 shrink-0 text-sm font-medium text-gray-900"
              />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-gray-900">{period.subjectName}</p>
                <p className="text-xs text-gray-600">
                  {fullName(period.teacher)}
                  {period.room && ` · ${period.room}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
