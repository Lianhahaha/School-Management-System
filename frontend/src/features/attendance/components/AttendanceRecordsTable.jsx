import { DataTable } from '../../../components/ui/DataTable';
import { formatDate } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

const COLUMNS = [
  {
    key: 'attendanceDate',
    header: 'Date',
    sortKey: 'attendanceDate',
    cell: (row) => <time dateTime={row.attendanceDate}>{formatDate(row.attendanceDate)}</time>,
  },
  { key: 'subject', header: 'Subject', cell: (row) => row.classSubject.subjectName },
  { key: 'status', header: 'Status', cell: (row) => <AttendanceStatusBadge status={row.status} /> },
  { key: 'remarks', header: 'Remarks', hideBelow: 'md', cell: (row) => row.remarks ?? '—' },
  { key: 'markedBy', header: 'Marked by', hideBelow: 'lg', cell: (row) => fullName(row.markedBy) },
];

/**
 * Flat attendance records (GET /attendance rows) as a sortable table. A thin wrapper over DataTable
 * so the student's page and any report share the same columns; list state comes from the page.
 * Takes the DataTable props `rows`, `isLoading`, `isFetching`, `error`, `onRetry`, `sort`, `onSortChange`, `emptyState`.
 */
export function AttendanceRecordsTable(props) {
  return <DataTable label="Attendance records" columns={COLUMNS} {...props} />;
}
