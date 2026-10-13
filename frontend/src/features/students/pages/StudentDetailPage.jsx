import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { DetailLoadError } from '../../../components/layout/DetailLoadError';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { academicYearToDate } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { AdmissionStatusBadge } from '../../admissions/components/AdmissionStatusBadge';
import { isApplicant } from '../../admissions/status';
import { AttendanceSummaryPanel } from '../../attendance/components/AttendanceSummaryPanel';
import { EnrollmentHistoryTable } from '../../enrollments/components/EnrollmentHistoryTable';
import { useSchoolYear } from '../../enrollments/hooks';
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
  // The school year the figures, the Attendance tab and the report card show: the one the student's own pages
  // open on, so a student placed in next year's class still shows this year's results here too.
  const schoolYear = useSchoolYear(studentId, '', student?.currentEnrollment ?? null);

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
                academicYear={schoolYear.academicYear}
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
            // The school year so far: the period the Overview tile that opens this tab counts, so the two show
            // the same rate.
            content: (
              <AttendanceSummaryPanel
                studentId={student.id}
                {...academicYearToDate(schoolYear.academicYear)}
              />
            ),
          },
          {
            id: 'grades',
            label: 'Grades',
            content: (
              <div className="space-y-4">
                {/* The report card is for that school year as a whole, and the student's class in it. */}
                {schoolYear.className && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <PrintReportCardButton studentId={student.id} academicYear={schoolYear.academicYear} />
                  </div>
                )}
                <GradeSummaryPanel studentId={student.id} />
                <GradeTrendCard studentId={student.id} />
                {schoolYear.className && (
                  <ReportCard
                    student={student}
                    studentId={student.id}
                    academicYear={schoolYear.academicYear}
                    className={schoolYear.className}
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
