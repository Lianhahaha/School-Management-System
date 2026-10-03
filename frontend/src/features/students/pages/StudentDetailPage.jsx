import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Tabs } from '../../../components/ui/Tabs';
import { fullName } from '../../../utils/names';
import { AttendanceSummaryPanel } from '../../attendance/components/AttendanceSummaryPanel';
import { EnrollmentHistoryTable } from '../../enrollments/components/EnrollmentHistoryTable';
import { GradeSummaryPanel } from '../../grades/components/GradeSummaryPanel';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';
import { StudentClassButton, StudentClassModals } from '../components/StudentClassModals';
import { StudentProfileForm } from '../components/StudentProfileForm';
import { useStudent } from '../hooks';

const STUDENTS_PATH = '/admin/students';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const { data: student, isPending, error, refetch } = useStudent(studentId);
  const [, setSearchParams] = useSearchParams();
  const [classTarget, setClassTarget] = useState(null);

  if (isPending && !error) return <PageSkeleton />;

  if (error) {
    return (
      <Card padded={false}>
        {error.status === 404 ? (
          <EmptyState
            title="Student not found"
            description="This student does not exist or was removed."
            action={
              <Button as={Link} to={STUDENTS_PATH}>
                Back to students
              </Button>
            }
          />
        ) : (
          <ErrorState title="Couldn't load student" message={error.message} onRetry={refetch} />
        )}
      </Card>
    );
  }

  const name = fullName(student);
  const hasClass = Boolean(student.currentEnrollment);

  return (
    <>
      <PageHeader
        title={name}
        description={student.studentNumber}
        breadcrumbs={[{ label: 'Students', to: STUDENTS_PATH }, { label: name }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSearchParams({ tab: 'profile' })}>
              Edit profile
            </Button>
            <StudentClassButton student={student} onSelect={setClassTarget} variant="primary" />
          </>
        }
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        {hasClass ? (
          <Badge tone="blue">{student.currentEnrollment.className}</Badge>
        ) : (
          <Badge tone="gray">Not enrolled</Badge>
        )}
        <UserStatusBadge isActive={student.isActive} />
      </div>

      <Tabs
        label="Student sections"
        tabs={[
          {
            id: 'profile',
            label: 'Profile',
            content: (
              <Card
                title="Profile"
                description="Changes are saved to the student's account and school record."
              >
                <StudentProfileForm student={student} />
              </Card>
            ),
          },
          {
            id: 'enrollments',
            label: 'Enrollments',
            content: <EnrollmentHistoryTable studentId={student.id} />,
          },
          {
            id: 'attendance',
            label: 'Attendance',
            content: <AttendanceSummaryPanel studentId={student.id} />,
          },
          {
            id: 'grades',
            label: 'Grades',
            content: <GradeSummaryPanel studentId={student.id} />,
          },
        ]}
      />

      <StudentClassModals student={classTarget} onClose={() => setClassTarget(null)} />
    </>
  );
}
