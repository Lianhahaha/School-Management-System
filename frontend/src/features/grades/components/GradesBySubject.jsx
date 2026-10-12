import { GraduationCap } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { todayYmd } from '../../../utils/date';
import { generalAverage, subjectRows } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { NotEnrolledState, NotInClassNote } from '../../enrollments/components/NotEnrolledState';
import { useAllGrades, useAssessments, useSemesterSummaries } from '../hooks';
import { GradesOverview } from './GradesOverview';
import { QuarterGradesTable } from './QuarterGradesTable';
import { SubjectResultList } from './SubjectResultList';
import { SubjectScores } from './SubjectScores';

/** The id of a subject's row in the grades table, to scroll to it. */
const rowIdOf = (subject) => `quarter-grades-${subject.subjectId}`;

/**
 * The signed-in student's grades of one school year, or of one semester of it: an overview (general average,
 * subjects passed, those below 75), the subjects as a list on the left and, on the right, one table of every
 * subject's grades with the general average (the four quarters and the final grade of a semester; the 1st and
 * 2nd Semester and the final grade of the whole year), then the scores of the chosen subject. Choosing a
 * subject marks its row in the table. A subject taken in two classes of the year (the student changed class)
 * is one subject, with the scores of both. The chosen subject lives in the URL (`subject`, a subject id) and
 * falls back to the first one.
 * Grades come from every page of GET /grades, results from GET /grades/summary: one request with the semester,
 * or one for each semester for the whole year, which is put together from them (see useSemesterSummaries).
 * A student who is not in a class (`notEnrolled`) still sees the grades of earlier classes, under a note; with
 * no grades at all and no class in this year (`inClass`) they get the not-enrolled state.
 *
 * @param {object} props
 * @param {string} props.academicYear the school year shown
 * @param {string} [props.semester] 'sem1' or 'sem2' for one semester; omit for the whole year
 * @param {boolean} [props.notEnrolled] the student has no active enrollment
 * @param {boolean} [props.inClass] the student has a class in the school year shown (default true)
 * @param {boolean} [props.withUpcoming] show upcoming assessments (only the current class has any)
 */
export function GradesBySubject({
  academicYear,
  semester,
  notEnrolled = false,
  inClass = true,
  withUpcoming = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const grades = useAllGrades({ academicYear, semester, sortBy: 'assessedOn', sortOrder: 'desc' });
  const summary = useSemesterSummaries({ studentId: 'me', academicYear, semester });
  const upcoming = useAssessments(
    { semester, dateFrom: todayYmd(), sortBy: 'assessedOn', sortOrder: 'asc', limit: PAGINATION.MAX_LIMIT },
    { enabled: withUpcoming },
  );

  const failed = grades.error ?? summary.error;
  if (failed) {
    const retry = () => Promise.all([grades.refetch(), summary.refetch()]);
    return <ErrorState title="Couldn't load grades" message={failed.message} onRetry={retry} />;
  }
  if (grades.isPending || summary.isPending) return <Skeleton className="h-96 w-full" />;
  if (grades.data.length === 0 && notEnrolled && !inClass) return <NotEnrolledState />;
  if (summary.data.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={
          semester
            ? 'No grades recorded for this semester yet'
            : 'No grades recorded for this school year yet'
        }
        description="Graded assessments will appear here."
      />
    );
  }

  // The summary rows are tagged with their semester. A subject is one row, with its quarters (a semester) or
  // its semesters (the whole year), and a subject taken in two classes puts the quarters of both together, as
  // the general average read off the same tagged rows does.
  const subjects = subjectRows(summary.data);
  const average = generalAverage(summary.data);
  // A subject's grades, newest first, from every class it was taken in.
  const gradesOf = (subject) =>
    grades.data.filter((grade) => subject.classSubjectIds.includes(grade.assessment.classSubjectId));
  const upcomingItems = withUpcoming ? (upcoming.data?.items ?? []) : [];
  const wanted = Number(searchParams.get('subject'));
  const selected = subjects.find((subject) => subject.subjectId === wanted) ?? subjects[0];
  // The teacher who graded the subject's latest result; the API has no per-subject teacher for students.
  const teacherOf = (subject) => {
    const latest = gradesOf(subject)[0];
    return latest?.gradedBy ? fullName(latest.gradedBy) : '';
  };
  // replace: picking a subject is not a new page, so Back leaves My grades. The page scrolls to the subject's
  // row only when it is out of sight (below the list on narrow screens).
  const select = (subject) => {
    setSearchParams(
      (params) => {
        params.set('subject', String(subject.subjectId));
        return params;
      },
      { replace: true },
    );
    document.getElementById(rowIdOf(subject))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        average={average}
        graded={grades.data.length}
        upcoming={withUpcoming && upcoming.data ? upcomingItems.length : null}
      />
      {/* Side by side only where the table keeps its room (with the sidebar, from 1280px); stacked below. */}
      <div className="grid items-start gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <SubjectResultList
          subjects={subjects}
          selectedKey={selected.key}
          onSelect={select}
          teacherOf={teacherOf}
        />
        <div className="grid min-w-0 gap-6">
          <QuarterGradesTable
            subjects={subjects}
            average={average}
            academicYear={academicYear}
            semester={semester}
            selectedKey={selected.key}
            rowIdOf={rowIdOf}
          />
          <SubjectScores
            subjectName={selected.subjectName}
            grades={gradesOf(selected)}
            next={upcomingItems.find((assessment) =>
              selected.classSubjectIds.includes(assessment.classSubjectId),
            )}
          />
        </div>
      </div>
    </div>
  );
}
