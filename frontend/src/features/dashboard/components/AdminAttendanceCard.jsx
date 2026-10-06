import { CalendarOff, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { useMinutesNow } from '../../../hooks/useMinutesNow';
import { formatDate } from '../../../utils/date';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { timeToMinutes } from '../../../utils/schedule';
import { AttendanceOverview } from './AttendanceOverview';
import { PeriodTime } from './PeriodTime';

/** How many lessons still to mark are listed; the rest are counted. */
const LIST_LIMIT = 5;

/** One lesson without attendance yet, linking to its sheet for today. */
function UnmarkedLesson({ lesson, date }) {
  const to = `/admin/attendance?classId=${lesson.classId}&classSubjectId=${lesson.classSubjectId}&date=${date}`;
  return (
    <li>
      <Link
        to={to}
        className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-gray-100"
      >
        <PeriodTime
          startTime={lesson.startTime}
          endTime={lesson.endTime}
          className="w-24 shrink-0 text-sm font-medium text-gray-900"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-gray-900">
            {lesson.className} · {lesson.subjectName}
          </span>
          <span className="block truncate text-xs text-gray-600">{fullName(lesson.teacher)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * School-wide attendance today (payload `attendanceToday`): how many of today's lessons are marked, the ones
 * that started without being marked (each opens its sheet), then the rate ring and status counts once marks
 * exist. On a school holiday (`holiday`, payload `holidayToday`) there is nothing to mark, so the card says
 * so and drops its link.
 */
export function AdminAttendanceCard({ attendance, holiday }) {
  const minutesNow = useMinutesNow();
  const { lessonsScheduled, lessonsMarked, unmarkedLessons, date } = attendance;
  const isHoliday = Boolean(holiday) && attendance.total === 0;
  // Only lessons that have started can be overdue; later ones are just counted.
  const overdue = unmarkedLessons.filter((lesson) => timeToMinutes(lesson.startTime) <= minutesNow);
  const later = unmarkedLessons.length - overdue.length;
  const isDone = lessonsScheduled > 0 && lessonsMarked >= lessonsScheduled;

  let body;
  if (isHoliday) {
    body = (
      <EmptyState
        icon={CalendarOff}
        title={`No classes today: ${holiday.title}`}
        description="It's a school holiday on the calendar, so there are no lessons and no attendance to mark."
        compact
      />
    );
  } else if (lessonsScheduled === 0 && attendance.total === 0) {
    body = <EmptyState icon={CalendarOff} title="No lessons on the timetable today" compact />;
  } else {
    body = (
      <div className="space-y-5">
        {lessonsScheduled > 0 && (
          <div>
            <p className="text-sm text-gray-700">
              <span className="text-2xl font-semibold text-gray-900">{lessonsMarked}</span> of{' '}
              {countOf(lessonsScheduled, 'lesson')} marked
            </p>
            <div
              role="progressbar"
              aria-label="Lessons marked today"
              aria-valuemin={0}
              aria-valuemax={lessonsScheduled}
              aria-valuenow={lessonsMarked}
              className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className={isDone ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-gray-900'}
                style={{ width: `${Math.min(100, (lessonsMarked / lessonsScheduled) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {overdue.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Not marked yet</h3>
            <ul>
              {overdue.slice(0, LIST_LIMIT).map((lesson) => (
                <UnmarkedLesson key={lesson.classSubjectId} lesson={lesson} date={date} />
              ))}
            </ul>
            {overdue.length > LIST_LIMIT && (
              <p className="mt-1 text-xs text-gray-600">
                and {countOf(overdue.length - LIST_LIMIT, 'more lesson')}
              </p>
            )}
          </div>
        )}
        {later > 0 && <p className="text-xs text-gray-600">{`${countOf(later, 'lesson')} later today.`}</p>}
        {isDone && <p className="text-xs text-green-700">Every lesson of today is marked.</p>}
        {attendance.total > 0 && <AttendanceOverview summary={attendance} />}
      </div>
    );
  }

  return (
    <Card
      icon={ClipboardCheck}
      mark="leaf"
      title="Attendance today"
      description={formatDate(date)}
      actions={isHoliday ? undefined : <TextLink to="/admin/attendance">Mark attendance</TextLink>}
    >
      {body}
    </Card>
  );
}
