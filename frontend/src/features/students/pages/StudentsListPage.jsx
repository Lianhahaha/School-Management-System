import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { GRADE_LEVEL_OPTIONS, NEW_ACCOUNT_DAYS, USER_STATUS_FILTER_OPTIONS } from '../../../constants/ui';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { isWithinDays, relativeTime } from '../../../utils/date';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { AdmissionStatusBadge } from '../../admissions/components/AdmissionStatusBadge';
import { isApplicant } from '../../admissions/status';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { EnrollStudentsModal } from '../../enrollments/components/EnrollStudentsModal';
import { UserFormModal } from '../../users/components/UserFormModal';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';
import { ImportStudentsModal } from '../components/ImportStudentsModal';
import { StudentClassButton, StudentClassModals } from '../components/StudentClassModals';
import { UNENROLLED_STUDENTS_PARAMS, useStudents } from '../hooks';

const ENROLLMENT_OPTIONS = [
  { value: 'true', label: 'Enrolled' },
  { value: 'false', label: 'Not enrolled' },
];

export default function StudentsListPage() {
  const list = useListParams({
    filters: ['classId', 'gradeLevel', 'hasActiveEnrollment', 'isActive'],
    defaultSort: ['lastName', 'asc'],
  });
  const { data, isPending, isFetching, error, refetch } = useStudents(list.apiParams);
  // The nav badge counts these students; the note below turns that count into the list it promises.
  const unenrolled = useStudents(UNENROLLED_STUDENTS_PARAMS);
  const unenrolledCount = unenrolled.data?.meta?.total ?? 0;
  const showUnenrolledNote = unenrolledCount > 0 && !list.params.hasActiveEnrollment;
  const createModal = useDisclosure();
  const enrollModal = useDisclosure();
  const importModal = useDisclosure();
  const [classTarget, setClassTarget] = useState(null);

  const columns = [
    { key: 'studentNumber', header: 'Student no', sortKey: 'studentNumber' },
    {
      key: 'name',
      header: 'Name',
      sortKey: 'lastName',
      cell: (student) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link to={String(student.id)} className="link">
            {fullName(student)}
          </Link>
          {isWithinDays(student.createdAt, NEW_ACCOUNT_DAYS) && (
            <Badge tone="oxblood" title={`Signed up ${relativeTime(student.createdAt)}`}>
              New
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'email', header: 'Email', hideBelow: 'md' },
    {
      key: 'class',
      header: 'Class',
      cell: (student) =>
        student.currentEnrollment ? (
          <Badge tone="blue">{student.currentEnrollment.className}</Badge>
        ) : isApplicant(student) ? (
          <AdmissionStatusBadge student={student} />
        ) : (
          <Badge tone="gray">Not enrolled</Badge>
        ),
    },
    { key: 'guardianPhone', header: 'Guardian phone', hideBelow: 'lg' },
    { key: 'isActive', header: 'Status', cell: (student) => <UserStatusBadge isActive={student.isActive} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (student) => <StudentClassButton student={student} onSelect={setClassTarget} />,
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Students"
        description="All registered students and their current class"
        actions={
          <>
            <Button variant="secondary" icon={FileUp} onClick={importModal.open}>
              Import
            </Button>
            <Button variant="secondary" onClick={enrollModal.open}>
              Enroll several
            </Button>
            <Button onClick={createModal.open}>Add student</Button>
          </>
        }
      />

      {showUnenrolledNote && (
        <Alert tone="warning" className="mb-4">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{`${countOf(unenrolledCount, 'student')} without a class.`}</span>
            <Link to={{ search: '?hasActiveEnrollment=false&isActive=true' }} replace className="link">
              Show them
            </Link>
          </span>
        </Alert>
      )}

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search name, student number, LRN"
        />
        <ClassSelect
          aria-label="Filter by class"
          value={list.params.classId}
          onChange={(event) => list.setFilter('classId', event.target.value)}
          placeholder="All classes"
        />
        <Select
          aria-label="Filter by grade"
          value={list.params.gradeLevel}
          onChange={(event) => list.setFilter('gradeLevel', event.target.value)}
          options={GRADE_LEVEL_OPTIONS}
          placeholder="Any grade"
        />
        <Select
          aria-label="Filter by enrollment"
          value={list.params.hasActiveEnrollment}
          onChange={(event) => list.setFilter('hasActiveEnrollment', event.target.value)}
          options={ENROLLMENT_OPTIONS}
          placeholder="Any enrollment"
        />
        <Select
          aria-label="Filter by status"
          value={list.params.isActive}
          onChange={(event) => list.setFilter('isActive', event.target.value)}
          options={USER_STATUS_FILTER_OPTIONS}
          placeholder="Any status"
        />
      </FilterBar>

      <DataTable
        label="Students"
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
          list.hasActiveFilters ? (
            <EmptyState
              title="No students match your filters"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No students yet"
              description="Add the first student to get started."
              action={<Button onClick={createModal.open}>Add student</Button>}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <UserFormModal open={createModal.isOpen} onClose={createModal.close} lockedRole="student" />
      <StudentClassModals student={classTarget} onClose={() => setClassTarget(null)} />
      <ImportStudentsModal open={importModal.isOpen} onClose={importModal.close} />
      <EnrollStudentsModal open={enrollModal.isOpen} onClose={enrollModal.close} />
    </>
  );
}
