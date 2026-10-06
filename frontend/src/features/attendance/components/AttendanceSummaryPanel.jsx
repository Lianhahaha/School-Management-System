import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatTile } from '../../../components/ui/StatTile';
import { ATTENDANCE_STATUS_LABELS } from '../../../constants/ui';
import { ATTENDANCE_STATUSES } from '../../../constants/shared';
import { countOf, formatPercent } from '../../../utils/format';
import { useAttendanceSummary } from '../hooks';
import { AttendanceTrendCard } from './AttendanceTrendCard';

const STATUS_TILE_TONES = { present: 'green', absent: 'red', late: 'amber', excused: 'blue' };

const SUBJECT_COLUMNS = [
  { key: 'label', header: 'Subject' },
  { key: 'present', header: 'Present', align: 'right' },
  { key: 'absent', header: 'Absent', align: 'right' },
  { key: 'late', header: 'Late', align: 'right' },
  { key: 'excused', header: 'Excused', align: 'right' },
  { key: 'rate', header: 'Rate', align: 'right', cell: (row) => formatPercent(row.rate) },
];

/**
 * Attendance of one student: a tile per status with its share, the overall rate
 * ((present + late) / total), the rate week by week and a per-subject breakdown. Fetches its own data, so the admin's
 * student page and the student's own pages use the same panel.
 *
 * @param {object} props
 * @param {number|string} props.studentId a student id, or 'me' for the signed-in student
 * @param {string} [props.dateFrom] 'YYYY-MM-DD', start of the period (default: everything)
 * @param {string} [props.dateTo] 'YYYY-MM-DD', end of the period
 * @param {boolean} [props.enabled] set false to hold the requests, for example while a student has no class yet
 */
export function AttendanceSummaryPanel({ studentId, dateFrom, dateTo, enabled = true }) {
  const filters = { studentId, dateFrom, dateTo };
  const overall = useAttendanceSummary(filters, { enabled });
  const bySubject = useAttendanceSummary({ ...filters, groupBy: 'classSubject' }, { enabled });

  if (overall.error) {
    return (
      <ErrorState
        title="Couldn't load attendance"
        message={overall.error.message}
        onRetry={overall.refetch}
      />
    );
  }
  if (overall.isPending) return <Skeleton className="h-28 w-full" />;

  const summary = overall.data;
  if (!summary.total) {
    return (
      <EmptyState title="No attendance recorded" description="Nothing has been marked between these dates." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Attendance rate"
          value={formatPercent(summary.rate)}
          hint={countOf(summary.total, 'period')}
        />
        {ATTENDANCE_STATUSES.map((status) => (
          <StatTile
            key={status}
            label={ATTENDANCE_STATUS_LABELS[status]}
            value={summary[status]}
            hint={formatPercent(summary[status] / summary.total)}
            tone={STATUS_TILE_TONES[status]}
          />
        ))}
      </div>
      <AttendanceTrendCard filters={filters} enabled={enabled} />
      <Card title="By subject" padded={false}>
        <DataTable
          label="Attendance by subject"
          columns={SUBJECT_COLUMNS}
          rows={bySubject.data ?? []}
          rowKey="classSubjectId"
          isLoading={bySubject.isPending}
          error={bySubject.error}
          onRetry={bySubject.refetch}
          emptyState={<EmptyState title="No subjects to show" />}
        />
      </Card>
    </div>
  );
}
