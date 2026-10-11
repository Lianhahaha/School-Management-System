import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SEMESTER_LABELS } from '../../../constants/ui';
import { formatScore } from '../../../utils/format';
import {
  describeGrading,
  describeQuarters,
  describeSemesters,
  formatResult,
  gradedQuarters,
  gradedSemesters,
  resultWidth,
  wholeYearRows,
} from '../../../utils/grades';
import { useSemesterSummaries } from '../hooks';
import { GradeDescriptor } from './GradeDescriptor';

/**
 * How the result was reached: the semester grades it averages once both semesters have one, else the one
 * semester that has it: the quarterly grades it averages once more than one quarter is graded, or that
 * quarter's K-12 initial grade, the subject's weights, or its points.
 * @param {ReturnType<typeof wholeYearRows>[number]} subject
 */
function resultBasis(subject) {
  const graded = `${subject.rows.reduce((sum, row) => sum + row.assessmentsGraded, 0)} graded`;
  if (gradedSemesters(subject).length > 1) return `Average of ${describeSemesters(subject)} · ${graded}`;
  const row = subject.rows.find((candidate) => candidate.percentage !== null) ?? subject.rows[0];
  const semester = SEMESTER_LABELS[row.semester];
  if (gradedQuarters(row).length > 1) return `${semester} · Average of ${describeQuarters(row)} · ${graded}`;
  if (row.method === 'k12')
    return `${semester} · Initial grade ${formatResult(row.initialGrade)} · ${graded}`;
  if (row.method === 'weighted') return `${semester} · ${describeGrading(row)} · ${graded}`;
  return `${semester} · ${formatScore(row.totalScore, row.totalMaxScore)} points · ${graded}`;
}

/**
 * Grades of one student: a card per class-subject (newest academic year first) with its grade, its DepEd
 * descriptor and a bar: the school year's, or the semester's with `semester`. Each quarter is graded on its
 * own, by K-12 components (transmuted to 60-100), on points (sum of scores / sum of max scores) or with the
 * subject's weights per assessment type; a semester's grade is the average of its quarterly grades and the
 * year's the average of its semesters'. The card says how it was reached.
 * Fetches its own data, so the admin's student page and the student's own pages use the same panel.
 *
 * @param {object} props
 * @param {number|string} props.studentId a student id, or 'me' for the signed-in student
 * @param {string} [props.academicYear] one school year (default: every year)
 * @param {string} [props.semester] 'sem1' or 'sem2' to restrict the summary to one semester (default: both)
 * @param {boolean} [props.enabled] set false to hold the request, for example while a student has no class yet
 */
export function GradeSummaryPanel({ studentId, academicYear, semester, enabled = true }) {
  const { data, error, isPending, refetch } = useSemesterSummaries(
    { studentId, academicYear, semester },
    { enabled },
  );

  if (error) return <ErrorState title="Couldn't load grades" message={error.message} onRetry={refetch} />;
  if (isPending) return <Skeleton className="h-28 w-full" />;
  if (data.length === 0) {
    return <EmptyState title="No grades recorded" description="Graded assessments will appear here." />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {wholeYearRows(data).map((subject) => (
        <li key={subject.classSubjectId}>
          <Card className="h-full">
            <h3 className="text-sm font-semibold text-gray-900">{subject.subjectName}</h3>
            <p className="text-xs text-gray-600">
              {subject.className} · {subject.academicYear}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                {formatResult(subject.percentage)}
              </span>
              <GradeDescriptor result={subject.percentage} />
            </p>
            <div
              role="progressbar"
              aria-label={`${subject.subjectName}, ${subject.className} result`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={subject.percentage ?? undefined}
              className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className="h-full rounded-full bg-gray-900"
                style={{ width: resultWidth(subject.percentage) }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">{resultBasis(subject)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
