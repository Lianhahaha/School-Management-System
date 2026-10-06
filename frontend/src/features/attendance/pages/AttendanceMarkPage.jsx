import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { fetchAllPages } from '../../../lib/csv';
import { Skeleton } from '../../../components/ui/Skeleton';
import { todayYmd } from '../../../utils/date';
import { ClassSubjectSelectorBar } from '../../classSubjects/components/ClassSubjectSelectorBar';
import { useClassSubjectSelection } from '../../classSubjects/hooks';
import { listAttendance } from '../api';
import { AttendanceSheet } from '../components/AttendanceSheet';
import { ATTENDANCE_CSV_COLUMNS } from '../csv';
import { useAttendanceSheet } from '../hooks';

/**
 * Admin and teacher: pick a lesson and a date, mark the roster, save. With a lesson picked, every
 * attendance record of that class and subject (all dates) can be downloaded as CSV.
 */
export default function AttendanceMarkPage() {
  const selection = useClassSubjectSelection({ withDate: true });
  const { classSubjectId, date, selected, isOwner } = selection;
  const isFuture = date > todayYmd();
  const sheet = useAttendanceSheet({ classSubjectId, date }, { enabled: !isFuture });

  let content;
  if (!classSubjectId) {
    content = (
      <EmptyState
        icon={ClipboardCheck}
        title="Pick a class and subject"
        description="Choose a class, a subject and a date to see the roster."
      />
    );
  } else if (isFuture) {
    content = (
      <EmptyState
        title="Pick a date up to today"
        description="Attendance can't be marked for a future date."
      />
    );
  } else if (sheet.error || selected.error) {
    const error = sheet.error ?? selected.error;
    content = (
      <ErrorState
        title="Couldn't load the attendance sheet"
        message={error.message}
        onRetry={sheet.error ? sheet.refetch : selected.refetch}
      />
    );
  } else if (sheet.isPending || selected.isPending) {
    content = (
      <div role="status" aria-busy="true" aria-label="Loading attendance sheet" className="space-y-3">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  } else {
    content = (
      <AttendanceSheet
        key={`${classSubjectId}:${date}`}
        sheet={sheet.data}
        canSave={isOwner}
        onReload={sheet.refetch}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark who was present, absent, late or excused in a period."
        actions={
          selected.data && (
            <ExportCsvButton
              fileName={`attendance ${selected.data.className} ${selected.data.subjectName}`}
              columns={ATTENDANCE_CSV_COLUMNS}
              getRows={() =>
                fetchAllPages(listAttendance, {
                  classSubjectId,
                  sortBy: 'attendanceDate',
                  sortOrder: 'asc',
                })
              }
              label="Download all attendance"
            />
          )
        }
      />
      <ClassSubjectSelectorBar selection={selection} withDate />
      {content}
    </>
  );
}
