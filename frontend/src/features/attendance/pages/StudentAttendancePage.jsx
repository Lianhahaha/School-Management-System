import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Input } from '../../../components/ui/Input';
import { OptionSelect } from '../../../components/ui/OptionSelect';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ATTENDANCE_STATUS_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { academicYearEnd, academicYearStart, todayYmd } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { NotEnrolledState, NotInClassNote } from '../../enrollments/components/NotEnrolledState';
import { SchoolYearSelect } from '../../enrollments/components/SchoolYearSelect';
import { useSchoolYear } from '../../enrollments/hooks';
import { listAttendance } from '../api';
import { AttendanceRecordsTable } from '../components/AttendanceRecordsTable';
import { AttendanceSummaryPanel } from '../components/AttendanceSummaryPanel';
import { ATTENDANCE_CSV_COLUMNS } from '../csv';
import { useAttendance, useAttendanceSummary } from '../hooks';

const earlier = (a, b) => (a <= b ? a : b);

/** The filters inside a year; the year itself is chosen in the page header. */
const YEAR_FILTERS = ['dateFrom', 'dateTo', 'classSubjectId', 'status'];

/**
 * The summary and records of one school year (August to July, up to today). The dates can be narrowed inside
 * the year; the subject filter lists the lessons the student has marks in that year. A student who is not in
 * a class (`notEnrolled`) still sees the attendance of earlier classes, under a note; with no records at all
 * they get the not-enrolled state.
 */
function StudentAttendanceContent({ list, academicYear, notEnrolled = false }) {
  const today = todayYmd();
  const yearStart = academicYearStart(academicYear);
  const lastDay = earlier(academicYearEnd(academicYear), today);
  const dateFrom = list.params.dateFrom || earlier(yearStart, today);
  const dateTo = list.params.dateTo || lastDay;
  // Typing can still produce an end before the start; the API rejects it, so ask instead of requesting.
  const isRangeValid = dateFrom <= dateTo;
  // GET /attendance has no text search: a `search` left in the URL (a shared link) would be refused.
  const { search: _search, academicYear: _year, ...listParams } = list.apiParams;
  const records = useAttendance({ ...listParams, dateFrom, dateTo }, { enabled: isRangeValid });
  // The lessons of that year come from the student's own marks: their past classes are not "their" classes
  // any more, so the class-subject list would not show them.
  const lessons = useAttendanceSummary({
    studentId: 'me',
    dateFrom: earlier(yearStart, lastDay),
    dateTo: lastDay,
    groupBy: 'classSubject',
  });

  const subjectOptions = lessons.data?.map((row) => ({
    value: String(row.classSubjectId),
    label: row.label,
  }));
  const hasYearFilters = YEAR_FILTERS.some((filter) => list.params[filter] !== '');
  const clearYearFilters = () =>
    list.setFilters(Object.fromEntries(YEAR_FILTERS.map((filter) => [filter, ''])));

  if (notEnrolled && records.data?.meta.total === 0 && !hasYearFilters) return <NotEnrolledState />;

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
        <FilterBar onClear={hasYearFilters ? clearYearFilters : undefined}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            From
            <Input
              type="date"
              value={dateFrom}
              min={yearStart}
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
              max={lastDay}
              onChange={(event) => list.setFilter('dateTo', event.target.value)}
              className="w-40"
            />
          </label>
          <OptionSelect
            aria-label="Subject"
            options={subjectOptions}
            isPending={lessons.isPending}
            isError={lessons.isError}
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

/**
 * A student's own attendance in one school year: summary tiles plus the records. The year sits in the page
 * header (it stays there when the not-enrolled state replaces the content) and in the URL (`academicYear`);
 * a new year clears the dates and the subject.
 */
export default function StudentAttendancePage() {
  const { me } = useAuth();
  const list = useListParams({
    filters: ['academicYear', 'dateFrom', 'dateTo', 'classSubjectId', 'status'],
    defaultSort: ['attendanceDate', 'desc'],
  });
  const schoolYear = useSchoolYear('me', list.params.academicYear, me.currentEnrollment);

  let content;
  if (schoolYear.isPending) content = <Skeleton className="h-40 w-full" />;
  else if (schoolYear.error) {
    content = (
      <ErrorState
        title="Couldn't load your school years"
        message={schoolYear.error.message}
        onRetry={schoolYear.refetch}
      />
    );
  } else {
    content = (
      <StudentAttendanceContent
        list={list}
        academicYear={schoolYear.academicYear}
        notEnrolled={!me.currentEnrollment}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="My attendance"
        description="How often you were present in your periods."
        actions={
          <SchoolYearSelect
            years={schoolYear.years}
            value={schoolYear.academicYear}
            onChange={(academicYear) =>
              list.setFilters({ academicYear, dateFrom: '', dateTo: '', classSubjectId: '' })
            }
            className="w-44"
          />
        }
      />
      {content}
    </>
  );
}
