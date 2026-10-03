import { Link, useParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Tabs } from '../../../components/ui/Tabs';
import { fullName } from '../../../utils/names';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';
import { TeacherAssignmentsTable } from '../components/TeacherAssignmentsTable';
import { TeacherHomeroomTable } from '../components/TeacherHomeroomTable';
import { TeacherProfileForm } from '../components/TeacherProfileForm';
import { TeacherTimetable } from '../components/TeacherTimetable';
import { useTeacher } from '../hooks';

const TEACHERS_PATH = '/admin/teachers';

export default function TeacherDetailPage() {
  const { teacherId } = useParams();
  const { data: teacher, isPending, error, refetch } = useTeacher(teacherId);

  if (isPending && !error) return <PageSkeleton />;

  if (error) {
    return (
      <Card padded={false}>
        {error.status === 404 ? (
          <EmptyState
            title="Teacher not found"
            description="This teacher does not exist or was removed."
            action={
              <Button as={Link} to={TEACHERS_PATH}>
                Back to teachers
              </Button>
            }
          />
        ) : (
          <ErrorState title="Couldn't load teacher" message={error.message} onRetry={refetch} />
        )}
      </Card>
    );
  }

  const name = fullName(teacher);

  return (
    <>
      <PageHeader
        title={name}
        description={[teacher.employeeNumber, teacher.department].filter(Boolean).join(' · ')}
        breadcrumbs={[{ label: 'Teachers', to: TEACHERS_PATH }, { label: name }]}
      />
      <div className="-mt-3 mb-6">
        <UserStatusBadge isActive={teacher.isActive} />
      </div>

      <Tabs
        label="Teacher sections"
        tabs={[
          {
            id: 'profile',
            label: 'Profile',
            content: (
              <Card
                title="Profile"
                description="Changes are saved to the teacher's account and staff record."
              >
                <TeacherProfileForm teacher={teacher} />
              </Card>
            ),
          },
          {
            id: 'assignments',
            label: 'Assignments',
            content: <TeacherAssignmentsTable teacherId={teacher.id} />,
          },
          {
            id: 'homeroom',
            label: 'Homeroom of',
            content: <TeacherHomeroomTable teacherId={teacher.id} />,
          },
          {
            id: 'timetable',
            label: 'Timetable',
            content: <TeacherTimetable teacherId={teacher.id} />,
          },
        ]}
      />
    </>
  );
}
