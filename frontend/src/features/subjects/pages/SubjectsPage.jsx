import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { describeGrading } from '../../../utils/grades';
import { SubjectFormModal } from '../components/SubjectFormModal';
import { useDeleteSubject, useSetSubjectActive, useSubjects } from '../hooks';

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Retired' },
];

export default function SubjectsPage() {
  const list = useListParams({ filters: ['isActive'], defaultSort: ['code', 'asc'] });
  const { data, isPending, isFetching, error, refetch } = useSubjects(list.apiParams);
  const createModal = useDisclosure();
  const [editTarget, setEditTarget] = useState(null);
  const confirm = useConfirm();
  const setActive = useSetSubjectActive();
  const deleteSubject = useDeleteSubject();

  const toggleActive = async (subject) => {
    const ok = subject.isActive
      ? await confirm({
          title: `Retire ${subject.name}?`,
          description: "It stays on the classes that already have it but can't be added to new ones.",
          confirmLabel: 'Retire',
        })
      : await confirm({
          title: `Reactivate ${subject.name}?`,
          description: 'It can be added to classes again.',
          confirmLabel: 'Reactivate',
          tone: 'primary',
        });
    if (ok) setActive.mutate({ id: subject.id, isActive: !subject.isActive });
  };

  const remove = async (subject) => {
    const ok = await confirm({
      title: `Delete ${subject.name}?`,
      description:
        'This permanently removes the subject. A subject that is already used by a class cannot be deleted; retire it instead.',
      confirmLabel: 'Delete',
    });
    if (ok) deleteSubject.mutate(subject.id);
  };

  const columns = [
    { key: 'code', header: 'Code', sortKey: 'code' },
    { key: 'name', header: 'Name', sortKey: 'name' },
    {
      key: 'description',
      header: 'Description',
      hideBelow: 'md',
      cell: (subject) =>
        subject.description ? (
          <span className="block max-w-xs truncate" title={subject.description}>
            {subject.description}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'grading',
      header: 'Grading',
      hideBelow: 'lg',
      cell: (subject) => describeGrading(subject),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (subject) => (
        <Badge tone={subject.isActive ? 'green' : 'gray'}>{subject.isActive ? 'Active' : 'Retired'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (subject) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditTarget(subject)}
            aria-label={`Edit ${subject.name}`}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleActive(subject)}
            disabled={setActive.isPending}
            aria-label={`${subject.isActive ? 'Retire' : 'Reactivate'} ${subject.name}`}
          >
            {subject.isActive ? 'Retire' : 'Reactivate'}
          </Button>
          <Button
            size="sm"
            variant="dangerGhost"
            onClick={() => remove(subject)}
            disabled={deleteSubject.isPending}
            aria-label={`Delete ${subject.name}`}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Subjects"
        description="The subject catalogue that classes draw from"
        actions={<Button onClick={createModal.open}>Create subject</Button>}
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search code, name" />
        <Select
          aria-label="Filter by status"
          value={list.params.isActive}
          onChange={(event) => list.setFilter('isActive', event.target.value)}
          options={STATUS_OPTIONS}
          placeholder="Active and retired"
        />
      </FilterBar>

      <DataTable
        label="Subjects"
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
              title="No subjects match your filters"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No subjects yet"
              description="Create the first subject to get started."
              action={<Button onClick={createModal.open}>Create subject</Button>}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <SubjectFormModal open={createModal.isOpen} onClose={createModal.close} />
      <SubjectFormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        subject={editTarget ?? undefined}
      />
    </>
  );
}
