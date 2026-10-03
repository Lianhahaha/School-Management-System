import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { USER_STATUS_FILTER_OPTIONS } from '../../../constants/ui';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { formatDate } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { UserFormModal } from '../../users/components/UserFormModal';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';
import { UserStatusButton } from '../../users/components/UserStatusButton';
import { useTeachers } from '../hooks';

export default function TeachersListPage() {
  const list = useListParams({ filters: ['isActive'] });
  const { data, isPending, isFetching, error, refetch } = useTeachers(list.apiParams);
  const createModal = useDisclosure();

  const columns = [
    { key: 'employeeNumber', header: 'Employee no', sortKey: 'employeeNumber' },
    {
      key: 'name',
      header: 'Name',
      sortKey: 'lastName',
      cell: (teacher) => (
        <Link to={String(teacher.id)} className="font-medium text-brand-700 hover:underline">
          {fullName(teacher)}
        </Link>
      ),
    },
    { key: 'email', header: 'Email', hideBelow: 'md' },
    { key: 'department', header: 'Department', sortKey: 'department', hideBelow: 'md' },
    {
      key: 'hireDate',
      header: 'Hire date',
      sortKey: 'hireDate',
      hideBelow: 'lg',
      cell: (teacher) => formatDate(teacher.hireDate),
    },
    { key: 'isActive', header: 'Status', cell: (teacher) => <UserStatusBadge isActive={teacher.isActive} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (teacher) => (
        <div className="flex justify-end gap-1">
          <Button
            as={Link}
            to={String(teacher.id)}
            size="sm"
            variant="secondary"
            aria-label={`View ${fullName(teacher)}`}
          >
            View
          </Button>
          <UserStatusButton user={{ ...teacher, id: teacher.userId }} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Teachers"
        description="Teaching staff, their assignments and homeroom classes"
        actions={<Button onClick={createModal.open}>Add teacher</Button>}
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search name, employee number, department"
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
        label="Teachers"
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
              title="No teachers match your filters"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No teachers yet"
              description="Add the first teacher to get started."
              action={<Button onClick={createModal.open}>Add teacher</Button>}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <UserFormModal open={createModal.isOpen} onClose={createModal.close} lockedRole="teacher" />
    </>
  );
}
