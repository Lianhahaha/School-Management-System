import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { ADMISSION_STATUS_LABELS, ADMISSION_STATUS_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { formatDate, isoToYmd } from '../../../utils/date';
import { toApiParams } from '../../../utils/listParams';
import { fullName } from '../../../utils/names';
import { EnrollStudentModal } from '../../enrollments/components/EnrollStudentModal';
import { useStudents } from '../../students/hooks';
import { AdmissionStatusBadge } from '../components/AdmissionStatusBadge';
import { DocumentChecklist } from '../components/DocumentChecklist';

/** The list opens on the applicants who have not picked a class yet. */
const DEFAULT_STATUS = 'pending';

/**
 * /admin/admissions: the applications sent with a self-registration, oldest first. Nobody approves them: the
 * student picks a class right after signing up, which admits them. The office ticks the documents off as they
 * arrive, and Admit (the usual enroll dialog) places a student who has not picked a class yet. Pending
 * applicants also count among the Students page's "without a class".
 */
export default function AdmissionsPage() {
  const list = useListParams({ filters: ['admissionStatus'], defaultSort: ['createdAt', 'asc'] });
  // Only the statuses the filter offers; an old link to `declined` opens the default list.
  const status = Object.hasOwn(ADMISSION_STATUS_LABELS, list.params.admissionStatus)
    ? list.params.admissionStatus
    : DEFAULT_STATUS;
  const { data, isPending, isFetching, error, refetch } = useStudents(
    toApiParams({
      ...list.apiParams,
      sortBy: list.params.sortBy,
      sortOrder: list.params.sortOrder,
      admissionStatus: status,
      // Waiting means an active account, as in the nav badge (PENDING_APPLICATIONS_PARAMS): a deactivated
      // applicant cannot be admitted. The admitted list stays a record of everyone admitted.
      ...(status === 'pending' && { isActive: 'true' }),
    }),
  );
  const [admitTarget, setAdmitTarget] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Applicant',
      sortKey: 'lastName',
      cell: (student) => (
        <Link to={`/admin/students/${student.id}`} className="link">
          {fullName(student)}
        </Link>
      ),
    },
    { key: 'grade', header: 'Applying for', cell: (student) => `Grade ${student.admission.gradeLevel}` },
    {
      key: 'previousSchool',
      header: 'Previous school',
      hideBelow: 'lg',
      cell: (student) => student.admission.previousSchool,
    },
    { key: 'lrn', header: 'LRN', hideBelow: 'lg' },
    {
      key: 'guardian',
      header: 'Guardian',
      hideBelow: 'md',
      cell: (student) =>
        student.guardianName ? (
          <span className="block">
            {student.guardianName}
            <span className="block text-xs text-gray-500">{student.guardianPhone}</span>
          </span>
        ) : null,
    },
    { key: 'documents', header: 'Documents', cell: (student) => <DocumentChecklist student={student} /> },
    { key: 'status', header: 'Status', cell: (student) => <AdmissionStatusBadge student={student} /> },
    {
      key: 'appliedAt',
      header: 'Applied',
      sortKey: 'createdAt',
      cell: (student) => formatDate(isoToYmd(student.admission.appliedAt)),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      // The office's shortcut for a student who has not picked a class; a deactivated account cannot be enrolled.
      cell: (student) =>
        !student.currentEnrollment &&
        student.isActive && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAdmitTarget(student)}
            aria-label={`Admit ${fullName(student)}`}
          >
            Admit
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Admissions"
        description="Students who applied on the sign-up page. They pick their class themselves; tick the documents as they arrive."
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search name, email, LRN"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) =>
            list.setFilter('admissionStatus', event.target.value === DEFAULT_STATUS ? '' : event.target.value)
          }
          options={ADMISSION_STATUS_OPTIONS}
        />
      </FilterBar>

      <DataTable
        label="Applications"
        columns={columns}
        rows={data?.items ?? []}
        rowKey="id"
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }}
        onSortChange={list.setSort}
        emptyState={
          list.params.search ? (
            <EmptyState
              title="No applications match your search"
              action={
                <Button variant="ghost" onClick={() => list.setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : status === DEFAULT_STATUS ? (
            <EmptyState
              title="No applications waiting"
              description="Students who sign up on the registration page appear here."
            />
          ) : (
            <EmptyState title={`No ${ADMISSION_STATUS_LABELS[status].toLowerCase()} applications`} />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <EnrollStudentModal
        student={admitTarget}
        open={Boolean(admitTarget)}
        onClose={() => setAdmitTarget(null)}
      />
    </>
  );
}
