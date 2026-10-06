import { Eye, Pencil, Plus, School, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Dropdown } from '../../../components/ui/Dropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { GRADE_LEVEL_OPTIONS, academicYearOptions } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { fullName } from '../../../utils/names';
import { ClassFormModal } from '../components/ClassFormModal';
import { useClasses, useDeleteClass } from '../hooks';

const YEAR_OPTIONS = academicYearOptions();

export default function ClassesListPage() {
  const list = useListParams({
    filters: ['academicYear', 'gradeLevel'],
    defaultSort: ['academicYear', 'desc'],
  });
  const { data, isPending, isFetching, error, refetch } = useClasses(list.apiParams);
  const deleteClass = useDeleteClass();
  const confirm = useConfirm();
  const createModal = useDisclosure();
  const [editing, setEditing] = useState(null);

  const onDelete = async (schoolClass) => {
    const ok = await confirm({
      title: `Delete ${schoolClass.name}?`,
      description:
        'The class is removed permanently. It cannot be deleted while it has students, subjects or periods.',
      confirmLabel: 'Delete class',
    });
    if (ok) deleteClass.mutate(schoolClass.id);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortKey: 'name',
      cell: (schoolClass) => (
        <Link to={`/admin/classes/${schoolClass.id}`} className="link">
          {schoolClass.name}
        </Link>
      ),
    },
    { key: 'gradeLevel', header: 'Grade', sortKey: 'gradeLevel', hideBelow: 'sm' },
    { key: 'academicYear', header: 'Academic year', sortKey: 'academicYear' },
    {
      key: 'homeroomTeacher',
      header: 'Homeroom teacher',
      hideBelow: 'md',
      cell: (schoolClass) =>
        schoolClass.homeroomTeacher ? (
          fullName(schoolClass.homeroomTeacher)
        ) : (
          <span className="text-gray-500">None</span>
        ),
    },
    { key: 'studentCount', header: 'Students', align: 'right' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (schoolClass) => (
        <Dropdown
          label={`Actions for ${schoolClass.name}`}
          items={[
            { label: 'View', icon: Eye, to: `/admin/classes/${schoolClass.id}` },
            { label: 'Edit', icon: Pencil, onClick: () => setEditing(schoolClass) },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(schoolClass) },
          ]}
        />
      ),
    },
  ];

  const createButton = (
    <Button icon={Plus} onClick={createModal.open}>
      Create class
    </Button>
  );

  return (
    <>
      <PageHeader
        total={data?.meta?.total}
        title="Classes"
        description="Each school year's groups of students, with their homeroom teacher."
        actions={createButton}
      />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search class name" />
        <Select
          aria-label="Academic year"
          value={list.params.academicYear}
          onChange={(event) => list.setFilter('academicYear', event.target.value)}
          options={YEAR_OPTIONS}
          placeholder="All academic years"
          className="sm:w-48"
        />
        <Select
          aria-label="Grade level"
          value={list.params.gradeLevel}
          onChange={(event) => list.setFilter('gradeLevel', event.target.value)}
          options={GRADE_LEVEL_OPTIONS}
          placeholder="All grades"
          className="sm:w-40"
        />
      </FilterBar>

      <DataTable
        label="Classes"
        columns={columns}
        rows={data?.items ?? []}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }}
        onSortChange={list.setSort}
        emptyState={
          list.hasActiveFilters ? (
            <EmptyState
              icon={School}
              title="No classes match your filters"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={School}
              title="No classes yet"
              description="Create the first class to start enrolling students."
              action={createButton}
            />
          )
        }
      />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <ClassFormModal open={createModal.isOpen} onClose={createModal.close} />
      <ClassFormModal open={Boolean(editing)} onClose={() => setEditing(null)} schoolClass={editing} />
    </>
  );
}
