import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { DetailLoadError } from '../../../components/layout/DetailLoadError';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { fullName } from '../../../utils/names';
import { AttendanceSummaryPanel } from '../../attendance/components/AttendanceSummaryPanel';
import { EnrollmentHistoryTable } from '../../enrollments/components/EnrollmentHistoryTable';
import { GradeSummaryPanel } from '../../grades/components/GradeSummaryPanel';
import { GradeTrendCard } from '../../grades/components/GradeTrendCard';
import { PrintReportCardButton, ReportCard } from '../../grades/components/ReportCard';
import { UserStatusBadge } from '../../users/components/UserStatusBadge';
import { StudentClassButton, StudentClassModals } from '../components/StudentClassModals';
import { StudentOverview } from '../components/StudentOverview';
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
      <DetailLoadError
        error={error}
        noun="student"
        backTo={STUDENTS_PATH}
        backLabel="Back to students"
        onRetry={refetch}
      />
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
        actions={<StudentClassButton student={student} onSelect={setClassTarget} variant="primary" />}
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
            id: 'overview',
            label: 'Overview',
            content: (
              <StudentOverview
                student={student}
                onOpenTab={(tab) => setSearchParams({ tab }, { replace: true })}
              />
            ),
          },
          {
            id: 'profile',
            label: 'Profile',
            content: (
              <Card
                title="Profile"
                description="Changes are saved to the student's account and school record."
              >
                <StudentProfileForm key={student.id} student={student} />
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
            content: (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <PrintReportCardButton />
                </div>
                <GradeSummaryPanel studentId={student.id} />
                <GradeTrendCard studentId={student.id} />
                <ReportCard student={student} enrollment={student.currentEnrollment} studentId={student.id} />
              </div>
            ),
          },
        ]}
      />

      <StudentClassModals student={classTarget} onClose={() => setClassTarget(null)} />
    </>
  );
}
