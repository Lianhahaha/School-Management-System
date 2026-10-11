import { GraduationCap } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { todayYmd } from '../../../utils/date';
import { groupBy } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { NotEnrolledState, NotInClassNote } from '../../enrollments/components/NotEnrolledState';
import { useAllGrades, useAssessments, useGradeSummary } from '../hooks';
import { GradesOverview } from './GradesOverview';
import { QuarterGradesTable } from './QuarterGradesTable';
import { SubjectResultList } from './SubjectResultList';
import { SubjectScores } from './SubjectScores';

/** The id of a subject's row in the grades table, to scroll to it. */
const rowIdOf = (classSubjectId) => `quarter-grades-${classSubjectId}`;

/**
 * The signed-in student's grades of one school year or quarter: an overview (general average, subjects
 * passed, those below 75), the subjects as a list on the left and, on the right, one table of every subject's
 * quarterly and final grades with the general average, then the scores of the chosen subject. Choosing a
 * subject marks its row in the table. The chosen subject lives in the URL (`subject`, a class-subject id) and
 * falls back to the first one.
 * Grades come from every page of GET /grades, results from GET /grades/summary. A student who is not in a
 * class (`notEnrolled`) still sees the grades of earlier classes, under a note; with no grades at all they get
 * the not-enrolled state.
 *
 * @param {object} props
 * @param {string} props.academicYear the school year shown
 * @param {string} [props.term] 'term1' to 'term4' for one quarter; omit for the whole year
 * @param {boolean} [props.notEnrolled] the student has no active enrollment
 * @param {boolean} [props.withUpcoming] show upcoming assessments (only the current class has any)
 */
export function GradesBySubject({ academicYear, term, notEnrolled = false, withUpcoming = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const grades = useAllGrades({ academicYear, term, sortBy: 'assessedOn', sortOrder: 'desc' });
  const summary = useGradeSummary({ studentId: 'me', academicYear, term, groupBy: 'classSubject' });
  const upcoming = useAssessments(
    { term, dateFrom: todayYmd(), sortBy: 'assessedOn', sortOrder: 'asc', limit: PAGINATION.MAX_LIMIT },
    { enabled: withUpcoming },
  );

  const failed = grades.error ?? summary.error;
  if (failed) {
    const retry = () => Promise.all([grades.refetch(), summary.refetch()]);
    return <ErrorState title="Couldn't load grades" message={failed.message} onRetry={retry} />;
  }
  if (grades.isPending || summary.isPending) return <Skeleton className="h-96 w-full" />;
  if (grades.data.length === 0 && notEnrolled && !term) return <NotEnrolledState />;
  if (summary.data.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={
          term ? 'No grades recorded for this quarter yet' : 'No grades recorded for this school year yet'
        }
        description="Graded assessments will appear here."
      />
    );
  }

  const subjects = summary.data;
  const gradesBySubject = groupBy(grades.data, (grade) => grade.assessment.classSubjectId);
  const upcomingItems = withUpcoming ? (upcoming.data?.items ?? []) : [];
  const wanted = Number(searchParams.get('subject'));
  const selected = subjects.find((subject) => subject.classSubjectId === wanted) ?? subjects[0];
  // The teacher who graded the subject's latest result; the API has no per-subject teacher for students.
  const teacherOf = (classSubjectId) => {
    const latest = gradesBySubject.get(classSubjectId)?.[0];
    return latest?.gradedBy ? fullName(latest.gradedBy) : '';
  };
  // replace: picking a subject is not a new page, so Back leaves My grades. The page scrolls to the subject's
  // row only when it is out of sight (below the list on narrow screens).
  const select = (classSubjectId) => {
    setSearchParams(
      (params) => {
        params.set('subject', String(classSubjectId));
        return params;
      },
      { replace: true },
    );
    document
      .getElementById(rowIdOf(classSubjectId))
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="space-y-6">
      {notEnrolled && (
        <NotInClassNote>
          You're not in a class right now. These are your grades from earlier classes.
        </NotInClassNote>
      )}
      <GradesOverview
        subjects={subjects}
        graded={grades.data.length}
        upcoming={withUpcoming && upcoming.data ? upcomingItems.length : null}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <SubjectResultList
          subjects={subjects}
          selectedId={selected.classSubjectId}
          onSelect={select}
          teacherOf={teacherOf}
        />
        <div className="grid min-w-0 gap-6">
          <QuarterGradesTable
            subjects={subjects}
            academicYear={academicYear}
            term={term}
            selectedId={selected.classSubjectId}
            teacherOf={teacherOf}
            rowIdOf={rowIdOf}
          />
          <SubjectScores
            subjectName={selected.subjectName}
            grades={gradesBySubject.get(selected.classSubjectId) ?? []}
            next={upcomingItems.find((assessment) => assessment.classSubjectId === selected.classSubjectId)}
          />
        </div>
      </div>
    </div>
  );
}
