import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { formatDate } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { NotEnrolledState } from '../../attendance/components/NotEnrolledState';
import { useAuth } from '../../auth/hooks';
import { useClassSubjects } from '../../classSubjects/hooks';
import { useSchedules } from '../../schedules/hooks';
import { useClass } from '../hooks';

/** The class details of the student's own class: a read-only card. */
function ClassCard({ classId, enrolledOn }) {
  const { data: schoolClass, isPending, error, refetch } = useClass(classId);

  if (isPending && !error) {
    return (
      <Card title="Your class">
        <div role="status" aria-label="Loading class" className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState title="Couldn't load your class" message={error.message} onRetry={refetch} />
      </Card>
    );
  }

  return (
    <Card
      title={schoolClass.name}
      description={`Academic year ${schoolClass.academicYear}`}
      actions={<Badge tone="green">Enrolled</Badge>}
    >
      <DescriptionList
        items={[
          { label: 'Grade', value: `Grade ${schoolClass.gradeLevel}` },
          { label: 'Academic year', value: schoolClass.academicYear },
          {
            label: 'Homeroom teacher',
            value: schoolClass.homeroomTeacher ? fullName(schoolClass.homeroomTeacher) : null,
          },
          { label: 'Classmates', value: Math.max(schoolClass.studentCount - 1, 0) },
          { label: 'Enrolled on', value: enrolledOn ? formatDate(enrolledOn) : null },
        ]}
      />
    </Card>
  );
}

/** The subjects of the student's class with their teachers and periods per week. */
function SubjectsCard() {
  const subjects = useClassSubjects({ limit: PAGINATION.MAX_LIMIT, sortBy: 'subjectName', sortOrder: 'asc' });
  const schedules = useSchedules({ limit: PAGINATION.MAX_LIMIT });

  const periodsBySubject = useMemo(() => {
    const counts = new Map();
    for (const slot of schedules.data?.items ?? []) {
      counts.set(slot.classSubjectId, (counts.get(slot.classSubjectId) ?? 0) + 1);
    }
    return counts;
  }, [schedules.data]);

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
      header: 'Periods per week',
      align: 'right',
      cell: (classSubject) =>
        schedules.isSuccess ? (
          (periodsBySubject.get(classSubject.id) ?? 0)
        ) : (
          <span aria-hidden="true">—</span>
        ),
    },
  ];

  return (
    <section aria-labelledby="my-subjects-heading">
      <h2 id="my-subjects-heading" className="mb-3 text-base font-semibold text-gray-900">
        Subjects and teachers
      </h2>
      <DataTable
        label="Subjects of my class"
        columns={columns}
        rows={subjects.data?.items ?? []}
        isLoading={subjects.isPending}
        isFetching={subjects.isFetching}
        error={subjects.error}
        onRetry={subjects.refetch}
        skeletonRows={4}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Your class has no subjects assigned. Check back soon."
          />
        }
      />
    </section>
  );
}

export default function MyClassPage() {
  const { me } = useAuth();
  const enrollment = me.currentEnrollment;

  return (
    <>
      <PageHeader title="My class" description="Your class, homeroom teacher and subjects." />
      {enrollment ? (
        <div className="space-y-6">
          <ClassCard classId={enrollment.classId} enrolledOn={enrollment.enrolledOn} />
          <SubjectsCard />
        </div>
      ) : (
        <div className="sheet">
          <NotEnrolledState />
        </div>
      )}
    </>
  );
}
