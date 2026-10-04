import { ArrowRightLeft, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Dropdown } from '../../../components/ui/Dropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { currentAcademicYear } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { EnrollStudentsModal } from '../../enrollments/components/EnrollStudentsModal';
import { TransferStudentModal } from '../../enrollments/components/TransferStudentModal';
import { useSetEnrollmentStatus } from '../../enrollments/hooks';
import { useStudents } from '../../students/hooks';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';

/**
 * "Students" tab of a class (admin): the roster with search, "Enroll students" (many at once; only
 * for a class of the current or a later academic year), Transfer and Withdraw. A student's
 * `currentEnrollment.id` is the active enrollment of this class.
 *
 * @param {object} props
 * @param {{ id: number, name: string }} props.schoolClass
 */
export function ClassStudentsTab({ schoolClass }) {
  const list = useListParams();
  const { data, isPending, isFetching, error, refetch } = useStudents({
    ...list.apiParams,
    classId: schoolClass.id,
  });
  const setStatus = useSetEnrollmentStatus();
  const confirm = useConfirm();
  const enrollModal = useDisclosure();
  const [transferring, setTransferring] = useState(null);

  const onWithdraw = async (student) => {
    const ok = await confirm({
      title: `Withdraw ${fullName(student)} from ${schoolClass.name}?`,
      description: 'The enrollment is closed today and kept in the history.',
      confirmLabel: 'Withdraw',
    });
    if (ok) setStatus.mutate({ id: student.currentEnrollment.id, status: 'withdrawn' });
  };

  const columns = [
    { key: 'studentNumber', header: 'Student no', sortKey: 'studentNumber' },
    {
      key: 'name',
      header: 'Name',
      sortKey: 'lastName',
      cell: (student) => (
        <Link to={`/admin/students/${student.id}`} className="link">
          {fullName(student)}
        </Link>
      ),
    },
    { key: 'guardianPhone', header: 'Guardian phone', hideBelow: 'md' },
    {
      key: 'isActive',
      header: 'Status',
      hideBelow: 'sm',
      cell: (student) => <UserStatusBadge isActive={student.isActive} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (student) => (
        <Dropdown
          label={`Actions for ${fullName(student)}`}
          items={[
            { label: 'Transfer', icon: ArrowRightLeft, onClick: () => setTransferring(student) },
            { label: 'Withdraw', icon: UserMinus, danger: true, onClick: () => onWithdraw(student) },
          ]}
        />
      ),
    },
  ];

  // The API refuses enrollments into a past academic year's class.
  const canEnroll = schoolClass.academicYear >= currentAcademicYear();
  const enrollButton = canEnroll && (
    <Button icon={UserPlus} onClick={enrollModal.open}>
      Enroll students
    </Button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
          <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search students" />
        </FilterBar>
        {enrollButton}
      </div>

      <DataTable
        label={`Students of ${schoolClass.name}`}
        columns={columns}
        rows={data?.items ?? []}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }}
        onSortChange={list.setSort}
        skeletonRows={5}
        emptyState={
          list.hasActiveFilters ? (
            <EmptyState
              icon={Users}
              title="No students match your search"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No students enrolled"
              description={
                canEnroll
                  ? 'Enroll the students who study in this class.'
                  : 'This class belongs to a past academic year, so no one can be enrolled in it.'
              }
              action={enrollButton}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <EnrollStudentsModal
        classId={schoolClass.id}
        className={schoolClass.name}
        open={enrollModal.isOpen}
        onClose={enrollModal.close}
      />
      <TransferStudentModal
        student={transferring}
        open={Boolean(transferring)}
        onClose={() => setTransferring(null)}
      />
    </div>
  );
}
