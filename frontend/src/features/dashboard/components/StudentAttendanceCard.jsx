import { ClipboardCheck, ClipboardList } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { formatDate } from '../../../utils/date';
import { AttendanceOverview } from './AttendanceOverview';

/** A student's attendance since the start of the academic year (payload `attendanceSummary`). */
export function StudentAttendanceCard({ summary }) {
  return (
    <Card
      icon={ClipboardList}
      mark="sage"
      title="My attendance"
      description={`${formatDate(summary.dateFrom)} to ${formatDate(summary.dateTo)}`}
      actions={<TextLink to="/student/attendance">Details</TextLink>}
    >
      {summary.total === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance recorded yet"
          description="Your attendance shows up here once teachers mark it."
          compact
        />
      ) : (
        <AttendanceOverview summary={summary} />
      )}
    </Card>
  );
}
