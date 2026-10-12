import { Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/Button';
import { PASSING_GRADE } from '../../../constants/shared';
import { APP_NAME, GENDER_LABELS, SEMESTER_LABELS } from '../../../constants/ui';
import { academicYearStart, ageOn, formatDate, todayYmd } from '../../../utils/date';
import {
  describeWeights,
  descriptorOf,
  formatResult,
  generalAverage,
  remarksOf,
  subjectRows,
} from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { useSemesterSummaries } from '../hooks';
import { gradeColumnsOf } from '../periods';

/** The grades on a report card. The card and its Print button share these requests (one cache entry each). */
const useReportCardSummaries = ({ studentId, academicYear, semester }) =>
  useSemesterSummaries({ studentId, academicYear, semester });

/**
 * Opens the browser's print dialog; the report card below replaces the page on paper. Until the card's grades
 * have arrived the button is disabled and says why on hover, so a half-loaded card is never printed as if the
 * student had no grades. Pass the same `studentId`, `academicYear` and `semester` as the ReportCard: it
 * prints the period the page shows.
 *
 * @param {object} props
 * @param {number|string} props.studentId a student id, or 'me'
 * @param {string} props.academicYear
 * @param {string} [props.semester] 'sem1' or 'sem2' for one semester; omit for the whole year
 */
export function PrintReportCardButton({ studentId, academicYear, semester }) {
  const { data, error } = useReportCardSummaries({ studentId, academicYear, semester });
  const isReady = data !== undefined;
  const blockedReason = error ? "The grades couldn't be loaded" : 'The grades are still loading';
  return (
    <span title={isReady ? undefined : blockedReason}>
      <Button
        variant="secondary"
        icon={Printer}
        onClick={() => window.print()}
        disabled={!isReady}
        className="print:hidden"
      >
        Print report card
      </Button>
    </span>
  );
}

/**
 * A student's report card for paper (DepEd SF9): who (with LRN, sex and the age on the first day of the school
 * year, as on the SF1), which class, school year and period, per subject the grade of each quarter of a
 * semester and its final grade (their average), or of each semester of the whole year and the final grade
 * (their average), with Passed / Failed, and the general average (the mean of the subject grades) with its
 * DepEd descriptor. A subject taken in two classes of the year is one line, its classes named together
 * ('Grade 10 - A / Grade 10 - B'). Notes explain the K-12 grading and the final grade and list any weighted subjects. It is
 * mounted at the end of <body> (a portal) and shown only when printing, in plain black on white whatever the
 * screen theme; the app itself is hidden then (see `.print-only` in index.css). Printed (Ctrl+P) before its
 * grades have arrived, it says so in place of the table instead of "No grades recorded".
 *
 * @param {object} props
 * @param {{ firstName: string, lastName: string, studentNumber: string, lrn?: string | null,
 *   gender?: string | null, dateOfBirth?: string | null }} props.student
 * @param {number|string} props.studentId a student id, or 'me'
 * @param {string} props.academicYear the school year on the card
 * @param {string} props.className the student's class in that year
 * @param {string} [props.semester] 'sem1' or 'sem2' for one semester; omit for the whole year
 */
export function ReportCard({ student, studentId, academicYear, className, semester }) {
  const summary = useReportCardSummaries({ studentId, academicYear, semester });
  // The summaries are tagged with their semester. A subject is one line, with its quarters (a semester) or its
  // semesters (the whole year), the classes of a student who changed class put together as the general
  // average puts them, which comes from the same tagged rows.
  const rows = summary.data ?? [];
  const subjects = subjectRows(rows);
  const average = generalAverage(rows);
  const weighted = subjects.filter((subject) => subject.method === 'weighted');
  const hasK12 = subjects.some((subject) => subject.method === 'k12');
  const age = ageOn(student.dateOfBirth, academicYearStart(academicYear));
  const gradeColumns = gradeColumnsOf(semester ?? '');
  const columnCount = gradeColumns.length + 4;

  return createPortal(
    <article className="print-only bg-white font-sans text-[11pt] text-black">
      <header className="flex items-end justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-[10pt] tracking-wide uppercase">{APP_NAME}</p>
          <h1 className="text-[20pt] font-semibold">Report card</h1>
        </div>
        <p className="text-right text-[10pt]">Printed {formatDate(todayYmd())}</p>
      </header>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <dt className="font-semibold">Student</dt>
        <dd>{fullName(student)}</dd>
        <dt className="font-semibold">Student no</dt>
        <dd>{student.studentNumber}</dd>
        <dt className="font-semibold">LRN</dt>
        <dd>{student.lrn ?? '—'}</dd>
        <dt className="font-semibold">Sex</dt>
        <dd>{GENDER_LABELS[student.gender] ?? '—'}</dd>
        <dt className="font-semibold">Age</dt>
        <dd>{age ?? '—'}</dd>
        <dt className="font-semibold">Class</dt>
        <dd>{`${className}, ${academicYear}`}</dd>
        <dt className="font-semibold">Period</dt>
        <dd>{semester ? SEMESTER_LABELS[semester] : 'Whole school year'}</dd>
      </dl>

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1.5 pr-3">Subject</th>
            <th className="py-1.5 pr-3">Class</th>
            {gradeColumns.map((column) => (
              <th key={column.key} className="py-1.5 pr-3 text-right">
                {column.header}
              </th>
            ))}
            <th className="py-1.5 pr-3 text-right">Final grade</th>
            <th className="py-1.5">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.key} className="border-b border-black/30">
              <td className="py-1.5 pr-3">{subject.subjectName}</td>
              <td className="py-1.5 pr-3">{subject.className}</td>
              {gradeColumns.map((column) => (
                <td key={column.key} className="py-1.5 pr-3 text-right">
                  {formatResult(column.gradeOf(subject))}
                </td>
              ))}
              <td className="py-1.5 pr-3 text-right font-semibold">{formatResult(subject.percentage)}</td>
              <td className="py-1.5">{remarksOf(subject.percentage) || '—'}</td>
            </tr>
          ))}
          {subjects.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="py-3">
                {summary.data !== undefined
                  ? 'No grades recorded.'
                  : summary.error
                    ? "The grades couldn't be loaded, so this report card is incomplete. Reload the page and print it again."
                    : 'The grades are still loading. Close this and print again in a moment.'}
              </td>
            </tr>
          )}
        </tbody>
        {subjects.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={columnCount - 2} className="py-2 font-semibold">
                General average (mean of the subject grades, each subject counted once)
              </td>
              <td className="py-2 pr-3 text-right font-semibold">{formatResult(average)}</td>
              <td className="py-2 font-semibold">{descriptorOf(average)?.label ?? '—'}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {subjects.length > 0 && (
        <p className="mt-3 text-[9pt]">
          {semester
            ? 'Final grade: the average of the quarterly grades of the semester (DepEd Order No. 8, s. 2015), a whole number in K-12 subjects; until the 4th Quarter is graded, the average of the quarters graded so far.'
            : 'Semester grade: the average of its quarterly grades (DepEd Order No. 8, s. 2015). Final grade: the average of the semester grades, a semester with no graded quarter left out. Both are whole numbers in K-12 subjects.'}
        </p>
      )}
      {hasK12 && (
        <p className="mt-3 text-[9pt]">
          K-12 subjects: each quarter's initial grade weighs written work, performance tasks and the quarterly
          assessment (DepEd Order No. 8, s. 2015) and is transmuted to the quarterly grade, 60 to 100. Passing
          grade is {PASSING_GRADE}.
        </p>
      )}
      {weighted.length > 0 && (
        <div className="mt-3 text-[9pt]">
          <p className="font-semibold">Weighted subjects</p>
          <ul>
            {weighted.map((subject) => (
              <li key={subject.key}>
                {subject.subjectName}: {describeWeights(subject.gradeWeights)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-10 text-[10pt]">
        <p className="border-t border-black pt-1">Homeroom teacher</p>
        <p className="border-t border-black pt-1">Parent or guardian</p>
      </footer>
    </article>,
    document.body,
  );
}
