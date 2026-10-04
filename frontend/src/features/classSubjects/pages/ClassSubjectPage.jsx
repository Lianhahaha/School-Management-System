import { Award, ClipboardCheck, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { DetailLoadError } from '../../../components/layout/DetailLoadError';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Button } from '../../../components/ui/Button';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { todayYmd } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { useAuth } from '../../auth/hooks';
import { AssessmentFormModal } from '../../grades/components/AssessmentFormModal';
import { ClassSubjectRoster } from '../components/ClassSubjectRoster';
import { SubjectSlotsCard } from '../components/SubjectSlotsCard';
import { useClassSubject } from '../hooks';

export default function ClassSubjectPage() {
  const { classSubjectId } = useParams();
  const { me } = useAuth();
  const assessmentModal = useDisclosure();
  const { data: classSubject, error, refetch } = useClassSubject(classSubjectId);

  if (error) {
    return (
      <DetailLoadError
        error={error}
        noun="class"
        backTo="/teacher/classes"
        backLabel="Back to my classes"
        onRetry={refetch}
      />
    );
  }
  if (!classSubject) return <PageSkeleton />;

  // Teachers can see their homeroom classes' subjects, but only the subject's own teacher writes.
  const isOwner = classSubject.teacherId === me.teacherId;
  const lessonLabel = `${classSubject.className} · ${classSubject.subjectName}`;

  return (
    <>
      <PageHeader
        title={lessonLabel}
        description={`${classSubject.academicYear} · Taught by ${fullName(classSubject.teacher)}${isOwner ? ' (you)' : ''}`}
        breadcrumbs={[{ label: 'My classes', to: '/teacher/classes' }, { label: lessonLabel }]}
        actions={
          isOwner && (
            <>
              <Button
                as={Link}
                to={`/teacher/attendance?classSubjectId=${classSubject.id}&date=${todayYmd()}`}
                variant="secondary"
                icon={ClipboardCheck}
              >
                Mark attendance
              </Button>
              <Button
                as={Link}
                to={`/teacher/grades?classSubjectId=${classSubject.id}`}
                variant="secondary"
                icon={Award}
              >
                Grades
              </Button>
              <Button icon={Plus} onClick={assessmentModal.open}>
                New assessment
              </Button>
            </>
          )
        }
      />

      <div className="space-y-6">
        <SubjectSlotsCard classSubjectId={classSubject.id} />
        <section aria-labelledby="roster-heading">
          <h2 id="roster-heading" className="mb-3 text-base font-semibold text-gray-900">
            Roster
          </h2>
          <ClassSubjectRoster classSubject={classSubject} />
        </section>
      </div>

      {isOwner && (
        <AssessmentFormModal
          open={assessmentModal.isOpen}
          onClose={assessmentModal.close}
          classSubjectId={classSubject.id}
          lessonLabel={lessonLabel}
        />
      )}
    </>
  );
}
