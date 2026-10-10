import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { DetailLoadError } from '../../../components/layout/DetailLoadError';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Tabs } from '../../../components/ui/Tabs';
import { PAGINATION } from '../../../constants/shared';
import { fullName } from '../../../utils/names';
import { AdmissionStatusBadge } from '../../admissions/components/AdmissionStatusBadge';
import { isApplicant } from '../../admissions/status';
import { AttendanceSummaryPanel } from '../../attendance/components/AttendanceSummaryPanel';
import { listEnrollments } from '../../enrollments/api';
import { EnrollmentHistoryTable } from '../../enrollments/components/EnrollmentHistoryTable';
import { getGradeSummary } from '../../grades/api';
import { GradeSummaryPanel } from '../../grades/components/GradeSummaryPanel';
import { GradeTrendCard } from '../../grades/components/GradeTrendCard';
import { PrintReportCardButton, ReportCard } from '../../grades/components/ReportCard';
import { SF10_CSV_COLUMNS, sf10Rows } from '../../grades/csv';
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
        description={student.lrn ? `${student.studentNumber} · LRN ${student.lrn}` : student.studentNumber}
        breadcrumbs={[{ label: 'Students', to: STUDENTS_PATH }, { label: name }]}
        actions={<StudentClassButton student={student} onSelect={setClassTarget} variant="primary" />}
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        {hasClass ? (
          <Badge tone="blue">{student.currentEnrollment.className}</Badge>
        ) : isApplicant(student) ? (
          <AdmissionStatusBadge student={student} />
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
                <div className="flex flex-wrap justify-end gap-2">
                  {/* SF10: every school year of the student, with the year's remarks. */}
                  <ExportCsvButton
                    label="Download SF10"
                    fileName={`SF10 ${name}`}
                    columns={SF10_CSV_COLUMNS}
                    getRows={async () => {
                      const [enrollments, subjects] = await Promise.all([
                        listEnrollments({ studentId: student.id, limit: PAGINATION.MAX_LIMIT }),
                        getGradeSummary({ studentId: student.id, groupBy: 'classSubject' }),
                      ]);
                      return sf10Rows(enrollments.items, subjects);
                    }}
                  />
                  {/* The report card is for the student's current class and its school year. */}
                  {student.currentEnrollment && (
                    <PrintReportCardButton
                      studentId={student.id}
                      academicYear={student.currentEnrollment.academicYear}
                    />
                  )}
                </div>
                <GradeSummaryPanel studentId={student.id} />
                <GradeTrendCard studentId={student.id} />
                {student.currentEnrollment && (
                  <ReportCard
                    student={student}
                    studentId={student.id}
                    academicYear={student.currentEnrollment.academicYear}
                    className={student.currentEnrollment.className}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <StudentClassModals student={classTarget} onClose={() => setClassTarget(null)} />
    </>
  );
}
