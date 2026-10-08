import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Input } from '../../../components/ui/Input';
import { OptionSelect } from '../../../components/ui/OptionSelect';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { ATTENDANCE_STATUS_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { academicYearStart, currentAcademicYear, todayYmd } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { useClassSubjectOptions } from '../../classSubjects/hooks';
import { NotEnrolledState, NotInClassNote } from '../../enrollments/components/NotEnrolledState';
import { listAttendance } from '../api';
import { AttendanceRecordsTable } from '../components/AttendanceRecordsTable';
import { AttendanceSummaryPanel } from '../components/AttendanceSummaryPanel';
import { ATTENDANCE_CSV_COLUMNS } from '../csv';
import { useAttendance } from '../hooks';

/**
 * The summary and records of a period. A student who is not in a class (`notEnrolled`) still sees the
 * attendance of earlier classes, by default since the start of last school year, under a note; with no
 * records at all they get the not-enrolled state.
 */
function StudentAttendanceContent({ academicYear, notEnrolled = false }) {
  const list = useListParams({
    filters: ['dateFrom', 'dateTo', 'classSubjectId', 'status'],
    defaultSort: ['attendanceDate', 'desc'],
  });
  const subjects = useClassSubjectOptions();

  const today = todayYmd();
  // A class of a year that has not started yet (enrolled ahead, in July) starts today, not in the future.
  const yearStart = notEnrolled
    ? academicYearStart(String(Number(academicYear.slice(0, 4)) - 1))
    : academicYearStart(academicYear);
  const dateFrom = list.params.dateFrom || (yearStart <= today ? yearStart : today);
  const dateTo = list.params.dateTo || today;
  // Typing can still produce an end before the start; the API rejects it, so ask instead of requesting.
  const isRangeValid = dateFrom <= dateTo;
  // GET /attendance has no text search: a `search` left in the URL (a shared link) would be refused.
  const { search: _search, ...listParams } = list.apiParams;
  const records = useAttendance({ ...listParams, dateFrom, dateTo }, { enabled: isRangeValid });

  const subjectOptions = subjects.data?.map(({ value, item }) => ({ value, label: item.subjectName }));

  if (notEnrolled && records.data?.meta.total === 0 && !list.hasActiveFilters) return <NotEnrolledState />;

  return (
    <div className="space-y-6">
      {notEnrolled && (
        <NotInClassNote>
          You're not in a class right now, so no new attendance is recorded. This is your attendance from
          earlier classes.
        </NotInClassNote>
      )}
      {isRangeValid && <AttendanceSummaryPanel studentId="me" dateFrom={dateFrom} dateTo={dateTo} />}

      <section aria-labelledby="attendance-records-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="attendance-records-heading" className="text-base font-semibold text-gray-900">
            Records
          </h2>
          {isRangeValid && (
            <ExportCsvButton
              size="sm"
              fileName={`my attendance ${dateFrom} to ${dateTo}`}
              columns={ATTENDANCE_CSV_COLUMNS}
              getRows={() =>
                fetchAllPages(listAttendance, {
                  dateFrom,
                  dateTo,
                  ...(list.params.classSubjectId && { classSubjectId: list.params.classSubjectId }),
                  ...(list.params.status && { status: list.params.status }),
                  sortBy: 'attendanceDate',
                  sortOrder: 'asc',
                })
              }
            />
          )}
        </div>
        <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            From
            <Input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => list.setFilter('dateFrom', event.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            To
            <Input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(event) => list.setFilter('dateTo', event.target.value)}
              className="w-40"
            />
          </label>
          <OptionSelect
            aria-label="Subject"
            options={subjectOptions}
            isPending={subjects.isPending}
            placeholder="All subjects"
            value={list.params.classSubjectId}
            onChange={(event) => list.setFilter('classSubjectId', event.target.value)}
            className="w-48"
          />
          <Select
            aria-label="Status"
            options={ATTENDANCE_STATUS_OPTIONS}
            placeholder="All statuses"
            value={list.params.status}
            onChange={(event) => list.setFilter('status', event.target.value)}
            className="w-40"
          />
        </FilterBar>
        {isRangeValid ? (
          <>
            <AttendanceRecordsTable
              rows={records.data?.items ?? []}
              isLoading={records.isPending}
              isFetching={records.isFetching}
              error={records.error}
              onRetry={records.refetch}
              sort={{
                sortBy: list.params.sortBy ?? 'attendanceDate',
                sortOrder: list.params.sortOrder ?? 'desc',
              }}
              onSortChange={list.setSort}
              emptyState={<EmptyState title="No attendance records between these dates" />}
            />
            <Pagination meta={records.data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
          </>
        ) : (
          <Alert tone="warning">The start date must be on or before the end date.</Alert>
        )}
      </section>
    </div>
  );
}

/** A student's own attendance: summary tiles plus the records of a period. */
export default function StudentAttendancePage() {
  const { me } = useAuth();
  const enrollment = me.currentEnrollment;

  return (
    <>
      <PageHeader title="My attendance" description="How often you were present in your periods." />
      <StudentAttendanceContent
        academicYear={enrollment?.academicYear ?? currentAcademicYear()}
        notEnrolled={!enrollment}
      />
    </>
  );
}
