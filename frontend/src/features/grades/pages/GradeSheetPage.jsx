import { useParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Badge } from '../../../components/ui/Badge';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ASSESSMENT_TYPE_LABELS, TERM_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { formatScore } from '../../../utils/format';
import { roleHome } from '../../../utils/roles';
import { useAuth } from '../../auth/hooks';
import { GradeSheet } from '../components/GradeSheet';
import { GRADE_SHEET_CSV_COLUMNS } from '../csv';
import { useAssessment, useGradeRoster } from '../hooks';

/** Admin and teacher: the roster of one assessment with a score per student. */
export default function GradeSheetPage() {
  const { assessmentId } = useParams();
  const { me, role } = useAuth();
  const roster = useGradeRoster(assessmentId);
  const assessment = useAssessment(assessmentId);

  const error = roster.error ?? assessment.error;
  if (error) {
    return (
      <ErrorState
        title="Couldn't load the grade sheet"
        message={error.message}
        onRetry={() => {
          if (roster.error) roster.refetch();
          if (assessment.error) assessment.refetch();
        }}
      />
    );
  }
  if (roster.isPending || assessment.isPending) return <PageSkeleton />;

  const { title, type, term, assessedOn, maxScore, className, subjectName, classSubjectId } =
    roster.data.assessment;
  const canSave = role === 'admin' || assessment.data.classSubject.teacherId === me.teacherId;

  return (
    <>
      <PageHeader
        title={title}
        description={`${className} · ${subjectName}`}
        breadcrumbs={[
          { label: 'Grades', to: `${roleHome(role)}/grades?classSubjectId=${classSubjectId}` },
          { label: title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <Badge tone="gray">{ASSESSMENT_TYPE_LABELS[type]}</Badge>
            <Badge tone="gray">{TERM_LABELS[term]}</Badge>
            <time dateTime={assessedOn}>{formatDate(assessedOn)}</time>
            <span>Max score {formatScore(maxScore)}</span>
            <ExportCsvButton
              size="sm"
              fileName={`grades ${className} ${subjectName} ${title}`}
              columns={GRADE_SHEET_CSV_COLUMNS}
              getRows={() => roster.data.records}
              label="Download saved scores"
            />
          </div>
        }
      />
      <GradeSheet key={assessmentId} roster={roster.data} canSave={canSave} onReload={roster.refetch} />
    </>
  );
}
