import { useParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { formatScore } from '../../../utils/format';
import { formatPeriod } from '../../../utils/grades';
import { roleHome } from '../../../utils/roles';
import { useAuth } from '../../auth/hooks';
import { isClassSubjectOwner } from '../../classSubjects/access';
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

  const { title, type, semester, term, assessedOn, maxScore, className, subjectName, classSubjectId } =
    roster.data.assessment;
  const canSave = isClassSubjectOwner(me, assessment.data.classSubject);

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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-band-ink/85">
            {/* One line in the band's light ink, readable on its dark red. */}
            <p>
              {ASSESSMENT_TYPE_LABELS[type]} · {formatPeriod(semester, term)} ·{' '}
              <time dateTime={assessedOn}>{formatDate(assessedOn)}</time> · Max score {formatScore(maxScore)}
            </p>
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
