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
import { DeclineApplicationModal } from '../components/DeclineApplicationModal';
import { DocumentChecklist } from '../components/DocumentChecklist';

/** The list opens on the applications that wait for the school office. */
const DEFAULT_STATUS = 'pending';

/**
 * /admin/admissions: the applications sent with a self-registration, oldest first. The office ticks the
 * documents off as they arrive, then admits (Enroll in a class, the usual enroll dialog) or declines with a
 * reason the applicant reads. Pending applicants are not in the Students page's "without a class" count.
 */
export default function AdmissionsPage() {
  const list = useListParams({ filters: ['admissionStatus'], defaultSort: ['createdAt', 'asc'] });
  const status = list.params.admissionStatus || DEFAULT_STATUS;
  const { data, isPending, isFetching, error, refetch } = useStudents(
    toApiParams({
      ...list.apiParams,
      sortBy: list.params.sortBy,
      sortOrder: list.params.sortOrder,
      admissionStatus: status,
    }),
  );
  const [admitTarget, setAdmitTarget] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);

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
      cell: (student) => (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {/* A declined applicant can still be admitted; a deactivated account cannot be enrolled. */}
          {!student.currentEnrollment && student.isActive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdmitTarget(student)}
              aria-label={`Admit ${fullName(student)}`}
            >
              Admit
            </Button>
          )}
          {student.admission.status === 'pending' && (
            <Button
              size="sm"
              variant="dangerGhost"
              onClick={() => setDeclineTarget(student)}
              aria-label={`Decline ${fullName(student)}`}
            >
              Decline
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Admissions"
        description="Students who applied on the sign-up page. Tick the documents as they arrive, then admit them into a class."
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
      <DeclineApplicationModal student={declineTarget} onClose={() => setDeclineTarget(null)} />
    </>
  );
}
