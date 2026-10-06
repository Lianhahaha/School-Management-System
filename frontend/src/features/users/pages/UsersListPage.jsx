import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { ROLE_OPTIONS, USER_STATUS_FILTER_OPTIONS } from '../../../constants/ui';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useOpenFromLink } from '../../../hooks/useOpenFromLink';
import { useListParams } from '../../../hooks/useListParams';
import { formatDate, isoToYmd } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { RoleBadge } from '../components/RoleBadge';
import { UserFormModal } from '../components/UserFormModal';
import { UserStatusBadge } from '../components/UserStatusBadge';
import { UserStatusButton } from '../components/UserStatusButton';
import { useUsers } from '../hooks';

export default function UsersListPage() {
  const list = useListParams({ filters: ['role', 'isActive'], defaultSort: ['lastName', 'asc'] });
  const { data, isPending, isFetching, error, refetch } = useUsers(list.apiParams);
  const createModal = useDisclosure();
  useOpenFromLink(createModal.open);
  const [editTarget, setEditTarget] = useState(null);

  const columns = [
    { key: 'name', header: 'Name', sortKey: 'lastName', cell: (user) => fullName(user) },
    { key: 'email', header: 'Email', sortKey: 'email', hideBelow: 'md' },
    { key: 'role', header: 'Role', cell: (user) => <RoleBadge role={user.role} /> },
    { key: 'isActive', header: 'Status', cell: (user) => <UserStatusBadge isActive={user.isActive} /> },
    {
      key: 'createdAt',
      header: 'Created',
      sortKey: 'createdAt',
      hideBelow: 'lg',
      cell: (user) => formatDate(isoToYmd(user.createdAt)),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditTarget(user)}
            aria-label={`Edit ${fullName(user)}`}
          >
            Edit
          </Button>
          <UserStatusButton user={user} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Users"
        description="Every account in the school, whatever its role"
        actions={<Button onClick={createModal.open}>Create user</Button>}
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search users" />
        <Select
          aria-label="Filter by role"
          value={list.params.role}
          onChange={(event) => list.setFilter('role', event.target.value)}
          options={ROLE_OPTIONS}
          placeholder="All roles"
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
        label="Users"
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
              title="No users match your filters"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No users yet"
              description="Create the first account to get started."
              action={<Button onClick={createModal.open}>Create user</Button>}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <UserFormModal open={createModal.isOpen} onClose={createModal.close} />
      <UserFormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        user={editTarget ?? undefined}
      />
    </>
  );
}
