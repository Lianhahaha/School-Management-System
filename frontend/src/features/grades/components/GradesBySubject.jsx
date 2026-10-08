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
import { SubjectResultDetail } from './SubjectResultDetail';
import { SubjectResultList } from './SubjectResultList';

/**
 * The signed-in student's grades of one school year or semester: an overview (general average, subjects
 * passed, those below 75), the subjects as a list on the left and the chosen subject in detail on the right
 * (its components, how the grade was worked out, its results over time and every graded assessment). The
 * chosen subject lives in the URL (`subject`, a class-subject id) and falls back to the first one.
 * Grades come from every page of GET /grades, results from GET /grades/summary. A student who is not in a
 * class (`notEnrolled`) still sees the grades of earlier classes, under a note; with no grades at all they get
 * the not-enrolled state.
 *
 * @param {object} props
 * @param {string} props.academicYear the school year shown
 * @param {string} [props.term] 'term1' | 'term2' | 'term3'; omit for the whole year
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
          term ? 'No grades recorded for this semester yet' : 'No grades recorded for this school year yet'
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
  // replace: picking a subject is not a new page, so Back leaves My grades. Where the detail sits below the
  // list (narrow screens), the page moves to it.
  const select = (classSubjectId) => {
    setSearchParams(
      (params) => {
        params.set('subject', String(classSubjectId));
        return params;
      },
      { replace: true },
    );
    if (!window.matchMedia('(min-width: 64rem)').matches) {
      document.getElementById('subject-detail')?.scrollIntoView({ behavior: 'smooth' });
    }
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
        <SubjectResultDetail
          key={selected.classSubjectId}
          subject={selected}
          grades={gradesBySubject.get(selected.classSubjectId) ?? []}
          teacher={teacherOf(selected.classSubjectId)}
          next={upcomingItems.find((assessment) => assessment.classSubjectId === selected.classSubjectId)}
        />
      </div>
    </div>
  );
}
