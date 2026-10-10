import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DetailLoadError } from '../../../components/layout/DetailLoadError';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { AttendanceTrendCard } from '../../attendance/components/AttendanceTrendCard';
import { Sf2Download } from '../../attendance/components/Sf2Download';
import { ClassFormModal } from '../components/ClassFormModal';
import { ClassScheduleTab } from '../components/ClassScheduleTab';
import { ClassStudentsTab } from '../components/ClassStudentsTab';
import { ClassSubjectsTab } from '../components/ClassSubjectsTab';
import { useClass, useDeleteClass } from '../hooks';

const BACK = { backTo: '/admin/classes', backLabel: 'Back to classes' };

export default function ClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const editModal = useDisclosure();
  const deleteClass = useDeleteClass();
  // While the class is being deleted its query is paused, so the refetch after the delete does not 404.
  const [deletingId, setDeletingId] = useState(null);
  const { data: schoolClass, error, refetch } = useClass(deletingId === classId ? undefined : classId);

  if (error) {
    return <DetailLoadError error={error} noun="class" onRetry={refetch} {...BACK} />;
  }
  if (!schoolClass) return <PageSkeleton />;

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${schoolClass.name}?`,
      description:
        'The class is removed permanently. It cannot be deleted while it has students, subjects or periods.',
      confirmLabel: 'Delete class',
    });
    if (!ok) return;
    setDeletingId(classId);
    deleteClass.mutate(classId, {
      onSuccess: () => navigate('/admin/classes', { replace: true }),
      onError: () => setDeletingId(null),
    });
  };

  const { homeroomTeacher, studentCount } = schoolClass;
  const description = [
    schoolClass.academicYear,
    `Grade ${schoolClass.gradeLevel}`,
    homeroomTeacher ? `Homeroom: ${fullName(homeroomTeacher)}` : 'No homeroom teacher',
    countOf(studentCount, 'student'),
  ].join(' · ');

  return (
    <>
      <PageHeader
        title={schoolClass.name}
        description={description}
        breadcrumbs={[{ label: 'Classes', to: '/admin/classes' }, { label: schoolClass.name }]}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={editModal.open}>
              Edit
            </Button>
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              Delete
            </Button>
          </>
        }
      />

      <Tabs
        label="Class sections"
        tabs={[
          {
            id: 'subjects',
            label: 'Subjects & Teachers',
            content: <ClassSubjectsTab schoolClass={schoolClass} />,
          },
          { id: 'students', label: 'Students', content: <ClassStudentsTab schoolClass={schoolClass} /> },
          { id: 'schedule', label: 'Schedule', content: <ClassScheduleTab schoolClass={schoolClass} /> },
          {
            id: 'attendance',
            label: 'Attendance',
            content: (
              <div className="space-y-4">
                <Sf2Download schoolClass={schoolClass} />
                <AttendanceTrendCard
                  filters={{ classId: schoolClass.id }}
                  description={`Every period of ${schoolClass.name}, ${schoolClass.academicYear}`}
                />
              </div>
            ),
          },
        ]}
      />

      <ClassFormModal open={editModal.isOpen} onClose={editModal.close} schoolClass={schoolClass} />
    </>
  );
}
