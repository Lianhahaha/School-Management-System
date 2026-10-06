import { BookOpen, Plus, Trash2, UserRoundCog } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Dropdown } from '../../../components/ui/Dropdown';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PAGINATION } from '../../../constants/shared';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { fullName } from '../../../utils/names';
import { AddClassSubjectModal } from '../../classSubjects/components/AddClassSubjectModal';
import { ChangeTeacherModal } from '../../classSubjects/components/ChangeTeacherModal';
import { useClassSubjects, useDeleteClassSubject } from '../../classSubjects/hooks';
import { useSchedules } from '../../schedules/hooks';

/**
 * "Subjects & Teachers" tab of a class: the teacher-assignment UI. A class-subject is an assignment,
 * so every subject row has a teacher. Add a subject with its teacher, change the teacher, remove it.
 *
 * @param {object} props
 * @param {{ id: number, name: string }} props.schoolClass
 */
export function ClassSubjectsTab({ schoolClass }) {
  const classId = schoolClass.id;
  const { data, isPending, isFetching, error, refetch } = useClassSubjects({
    classId,
    limit: PAGINATION.MAX_LIMIT,
    sortBy: 'subjectName',
    sortOrder: 'asc',
  });
  const schedules = useSchedules({ classId, limit: PAGINATION.MAX_LIMIT });
  const deleteClassSubject = useDeleteClassSubject();
  const confirm = useConfirm();
  const addModal = useDisclosure();
  const [reassigning, setReassigning] = useState(null);

  const rows = data?.items ?? [];
  const periodsBySubject = useMemo(() => {
    const counts = new Map();
    for (const slot of schedules.data?.items ?? []) {
      counts.set(slot.classSubjectId, (counts.get(slot.classSubjectId) ?? 0) + 1);
    }
    return counts;
  }, [schedules.data]);

  const onRemove = async (classSubject) => {
    const ok = await confirm({
      title: `Remove ${classSubject.subjectName} from ${schoolClass.name}?`,
      description: 'This fails if it has periods on the schedule, attendance or assessments.',
      confirmLabel: 'Remove subject',
    });
    if (ok) deleteClassSubject.mutate(classSubject.id);
  };

  const columns = [
    {
      key: 'subject',
      header: 'Subject',
      cell: (classSubject) => (
        <span className="font-medium text-gray-900">
          {classSubject.subjectCode} · {classSubject.subjectName}
        </span>
      ),
    },
    { key: 'teacher', header: 'Teacher', cell: (classSubject) => fullName(classSubject.teacher) },
    {
      key: 'periods',
      header: 'Weekly periods',
      align: 'right',
      hideBelow: 'sm',
      cell: (classSubject) =>
        schedules.isSuccess ? (
          (periodsBySubject.get(classSubject.id) ?? 0)
        ) : (
          <span aria-hidden="true">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (classSubject) => (
        <Dropdown
          label={`Actions for ${classSubject.subjectName}`}
          items={[
            { label: 'Change teacher', icon: UserRoundCog, onClick: () => setReassigning(classSubject) },
            { label: 'Remove', icon: Trash2, danger: true, onClick: () => onRemove(classSubject) },
          ]}
        />
      ),
    },
  ];

  const addButton = (
    <Button icon={Plus} onClick={addModal.open}>
      Add subject
    </Button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Each subject of the class and the teacher who teaches it.</p>
        {rows.length > 0 && addButton}
      </div>

      <DataTable
        label={`Subjects of ${schoolClass.name}`}
        columns={columns}
        rows={rows}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        skeletonRows={4}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Add the subjects this class studies and choose a teacher for each."
            action={addButton}
          />
        }
      />

      <AddClassSubjectModal
        classId={classId}
        className={schoolClass.name}
        excludeSubjectIds={rows.map((classSubject) => classSubject.subjectId)}
        open={addModal.isOpen}
        onClose={addModal.close}
      />
      <ChangeTeacherModal
        classSubject={reassigning}
        open={Boolean(reassigning)}
        onClose={() => setReassigning(null)}
      />
    </div>
  );
}
