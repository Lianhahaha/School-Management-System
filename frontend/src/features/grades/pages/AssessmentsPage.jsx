import { ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { Pagination } from '../../../components/ui/Pagination';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { ASSESSMENT_TYPE_OPTIONS, TERM_OPTIONS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useListParams } from '../../../hooks/useListParams';
import { roleHome } from '../../../utils/roles';
import { ClassSubjectSelectorBar } from '../../classSubjects/components/ClassSubjectSelectorBar';
import { useClassSubjectSelection } from '../../classSubjects/hooks';
import { AssessmentFormModal } from '../components/AssessmentFormModal';
import { AssessmentsTable } from '../components/AssessmentsTable';
import { useAssessments, useDeleteAssessment } from '../hooks';
import { countOf } from '../../../utils/format';

/** Admin and teacher: the assessments of one lesson, with create, edit and delete for its owner. */
export default function AssessmentsPage() {
  const selection = useClassSubjectSelection();
  const { role, classSubjectId, selected, isOwner } = selection;
  const list = useListParams({ filters: ['term', 'type'], defaultSort: ['assessedOn', 'desc'] });
  const confirm = useConfirm();
  const modal = useDisclosure();
  const [editing, setEditing] = useState(null);
  const deleteAssessment = useDeleteAssessment();

  const { data, isPending, isFetching, error, refetch } = useAssessments(
    {
      ...list.apiParams,
      sortBy: list.params.sortBy ?? 'assessedOn',
      sortOrder: list.params.sortOrder ?? 'desc',
      classSubjectId,
    },
    { enabled: Boolean(classSubjectId) },
  );

  const lesson = selected.data;
  const lessonLabel = lesson ? `${lesson.className} · ${lesson.subjectName}` : undefined;
  const canManage = isOwner && Boolean(lesson);

  const openCreate = () => {
    setEditing(null);
    modal.open();
  };
  const openEdit = (assessment) => {
    setEditing(assessment);
    modal.open();
  };
  const onDelete = async (assessment) => {
    const graded = assessment.gradedCount;
    const ok = await confirm({
      title: `Delete ${assessment.title}?`,
      description:
        graded > 0
          ? `Deleting removes its ${countOf(graded, 'recorded grade')}. This cannot be undone.`
          : 'This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (ok) deleteAssessment.mutate(assessment.id);
  };

  let content;
  if (!classSubjectId) {
    content = (
      <EmptyState
        icon={ClipboardList}
        title="Pick a class and subject"
        description="Choose a lesson to see its assessments."
      />
    );
  } else if (selected.error) {
    content = (
      <ErrorState
        title="Couldn't load the class and subject"
        message={selected.error.message}
        onRetry={selected.refetch}
      />
    );
  } else {
    const emptyState =
      data?.meta.total === 0 && !list.hasActiveFilters ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description={canManage ? 'Create the first test, exam or assignment for this lesson.' : undefined}
          action={
            canManage && (
              <Button icon={Plus} onClick={openCreate}>
                Create assessment
              </Button>
            )
          }
        />
      ) : (
        <EmptyState
          title="No assessments match your filters"
          action={
            <Button variant="secondary" onClick={list.clearFilters}>
              Clear filters
            </Button>
          }
        />
      );

    content = (
      <>
        <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
          <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search title" />
          <Select
            aria-label="Term"
            options={TERM_OPTIONS}
            placeholder="All terms"
            value={list.params.term}
            onChange={(event) => list.setFilter('term', event.target.value)}
            className="w-40"
          />
          <Select
            aria-label="Type"
            options={ASSESSMENT_TYPE_OPTIONS}
            placeholder="All types"
            value={list.params.type}
            onChange={(event) => list.setFilter('type', event.target.value)}
            className="w-44"
          />
        </FilterBar>
        <AssessmentsTable
          rows={data?.items ?? []}
          isLoading={isPending}
          isFetching={isFetching}
          error={error}
          onRetry={refetch}
          sort={{
            sortBy: list.params.sortBy ?? 'assessedOn',
            sortOrder: list.params.sortOrder ?? 'desc',
          }}
          onSortChange={list.setSort}
          emptyState={emptyState}
          sheetPath={(assessment) =>
            `${roleHome(role)}/grades/assessments/${assessment.id}?classSubjectId=${assessment.classSubjectId}`
          }
          canManage={canManage}
          onEdit={openEdit}
          onDelete={onDelete}
        />
        <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Grades"
        description="Tests, exams and assignments of a lesson, and the scores students earned."
        actions={
          canManage && (
            <Button icon={Plus} onClick={openCreate}>
              Create assessment
            </Button>
          )
        }
      />
      <ClassSubjectSelectorBar selection={selection} />
      {content}
      <AssessmentFormModal
        open={modal.isOpen}
        onClose={modal.close}
        assessment={editing ?? undefined}
        classSubjectId={classSubjectId}
        lessonLabel={lessonLabel}
      />
    </>
  );
}
