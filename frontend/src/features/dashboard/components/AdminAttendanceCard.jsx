import { CalendarOff, ClipboardCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { formatDate } from '../../../utils/date';
import { AttendanceOverview } from './AttendanceOverview';

/**
 * School-wide attendance today (payload `attendanceToday`): rate ring and the four status counts. On a school
 * holiday (`holiday`, payload `holidayToday`) there is nothing to mark, so the card says so and drops its link.
 */
export function AdminAttendanceCard({ attendance, holiday }) {
  const isHoliday = Boolean(holiday) && attendance.total === 0;
  return (
    <Card
      icon={ClipboardCheck}
      mark="leaf"
      title="Attendance today"
      description={formatDate(attendance.date)}
      actions={isHoliday ? undefined : <TextLink to="/admin/attendance">Mark attendance</TextLink>}
    >
      {isHoliday ? (
        <EmptyState
          icon={CalendarOff}
          title={`No classes today: ${holiday.title}`}
          description="It's a school holiday on the calendar, so there are no lessons and no attendance to mark."
          compact
        />
      ) : attendance.total === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance marked yet today"
          description="The rate appears once the first lesson is marked."
          compact
        />
      ) : (
        <AttendanceOverview summary={attendance} />
      )}
    </Card>
  );
}
