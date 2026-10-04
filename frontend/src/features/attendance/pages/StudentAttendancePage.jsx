import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Input } from '../../../components/ui/Input';
import { OptionSelect } from '../../../components/ui/OptionSelect';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { ACADEMIC_YEAR_START_MONTH } from '../../../constants/shared';
import { ATTENDANCE_STATUS_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { todayYmd } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { useClassSubjectOptions } from '../../classSubjects/hooks';
import { NotEnrolledState } from '../../enrollments/components/NotEnrolledState';
import { AttendanceRecordsTable } from '../components/AttendanceRecordsTable';
import { AttendanceSummaryPanel } from '../components/AttendanceSummaryPanel';
import { useAttendance } from '../hooks';

/** First day of an academic year such as '2026-2027' ('2026-08-01'). */
const academicYearStart = (academicYear) =>
  `${academicYear.slice(0, 4)}-${String(ACADEMIC_YEAR_START_MONTH).padStart(2, '0')}-01`;

/** Everything of the page that needs a class; only rendered for an enrolled student. */
function StudentAttendanceContent({ academicYear }) {
  const list = useListParams({ filters: ['dateFrom', 'dateTo', 'classSubjectId', 'status'] });
  const subjects = useClassSubjectOptions();

  const today = todayYmd();
  const dateFrom = list.params.dateFrom || academicYearStart(academicYear);
  const dateTo = list.params.dateTo || today;
  // Typing can still produce an end before the start; the API rejects it, so ask instead of requesting.
  const isRangeValid = dateFrom <= dateTo;
  const records = useAttendance({ ...list.apiParams, dateFrom, dateTo }, { enabled: isRangeValid });

  const subjectOptions = subjects.data?.map(({ value, item }) => ({ value, label: item.subjectName }));

  return (
    <div className="space-y-6">
      {isRangeValid && <AttendanceSummaryPanel studentId="me" dateFrom={dateFrom} dateTo={dateTo} />}

      <section aria-labelledby="attendance-records-heading">
        <h2 id="attendance-records-heading" className="mb-3 text-base font-semibold text-gray-900">
          Records
        </h2>
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
              emptyState={<EmptyState title="No attendance records in this period" />}
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
      <PageHeader title="My attendance" description="How often you were present in your lessons." />
      {enrollment ? (
        <StudentAttendanceContent academicYear={enrollment.academicYear} />
      ) : (
        <NotEnrolledState />
      )}
    </>
  );
}
