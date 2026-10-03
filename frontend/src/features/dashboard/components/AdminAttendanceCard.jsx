import { ClipboardCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { LiveTag } from '../../../components/ui/LiveTag';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { formatDate } from '../../../utils/date';
import { AttendanceOverview } from './AttendanceOverview';

/** School-wide attendance today (payload `attendanceToday`): rate ring and the four status counts. */
export function AdminAttendanceCard({ attendance }) {
  return (
    <Card
      title="Attendance today"
      total={<LiveTag>Today</LiveTag>}
      description={formatDate(attendance.date)}
      actions={<TextLink to="/admin/attendance">Mark attendance</TextLink>}
    >
      {attendance.total === 0 ? (
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
