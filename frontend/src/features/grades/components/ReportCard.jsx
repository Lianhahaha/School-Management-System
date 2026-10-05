import { Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/Button';
import { APP_NAME, TERM_LABELS } from '../../../constants/ui';
import { formatDate, todayYmd } from '../../../utils/date';
import { formatPercent, formatScore } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { useGradeSummary } from '../hooks';

/** Opens the browser's print dialog; the report card below replaces the page on paper. */
export function PrintReportCardButton() {
  return (
    <Button variant="secondary" icon={Printer} onClick={() => window.print()} className="print:hidden">
      Print report card
    </Button>
  );
}

/**
 * A student's report card for paper: who, which class and term, and per subject the points-weighted
 * percentage, plus the overall result, for the academic year of `enrollment` (all years without one). It is mounted at the end of <body> (a portal) and shown only
 * when printing, in plain black on white whatever the screen theme; the app itself is hidden then
 * (see `.print-only` in index.css).
 *
 * @param {object} props
 * @param {{ firstName: string, lastName: string, studentNumber: string }} props.student
 * @param {{ className: string, academicYear: string } | null} props.enrollment the current class
 * @param {number|string} props.studentId a student id, or 'me'
 * @param {string} [props.term] 'term1' | 'term2' | 'term3'; omit for all terms
 */
export function ReportCard({ student, enrollment, studentId, term }) {
  const { data: allYears = [] } = useGradeSummary({ studentId, term, groupBy: 'classSubject' });
  // The summary covers every year the student has grades in; the card is about the class it names.
  const subjects = enrollment
    ? allYears.filter((subject) => subject.academicYear === enrollment.academicYear)
    : allYears;
  const totalScore = subjects.reduce((sum, subject) => sum + subject.totalScore, 0);
  const totalMaxScore = subjects.reduce((sum, subject) => sum + subject.totalMaxScore, 0);

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
        <dt className="font-semibold">Class</dt>
        <dd>{enrollment ? `${enrollment.className}, ${enrollment.academicYear}` : 'Not enrolled'}</dd>
        <dt className="font-semibold">Period</dt>
        <dd>{term ? TERM_LABELS[term] : 'All terms'}</dd>
      </dl>

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1.5 pr-3">Subject</th>
            <th className="py-1.5 pr-3">Class</th>
            <th className="py-1.5 pr-3 text-right">Graded</th>
            <th className="py-1.5 pr-3 text-right">Points</th>
            <th className="py-1.5 text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.classSubjectId} className="border-b border-black/30">
              <td className="py-1.5 pr-3">{subject.subjectName}</td>
              <td className="py-1.5 pr-3">{subject.className}</td>
              <td className="py-1.5 pr-3 text-right">{subject.assessmentsGraded}</td>
              <td className="py-1.5 pr-3 text-right">
                {formatScore(subject.totalScore, subject.totalMaxScore)}
              </td>
              <td className="py-1.5 text-right font-semibold">{formatPercent(subject.percentage / 100)}</td>
            </tr>
          ))}
          {subjects.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3">
                No grades recorded.
              </td>
            </tr>
          )}
        </tbody>
        {subjects.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={3} className="py-2 font-semibold">
                Overall (all points together)
              </td>
              <td className="py-2 pr-3 text-right">{formatScore(totalScore, totalMaxScore)}</td>
              <td className="py-2 text-right font-semibold">
                {formatPercent(totalMaxScore > 0 ? totalScore / totalMaxScore : null)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      <footer className="mt-10 grid grid-cols-2 gap-10 text-[10pt]">
        <p className="border-t border-black pt-1">Homeroom teacher</p>
        <p className="border-t border-black pt-1">Parent or guardian</p>
      </footer>
    </article>,
    document.body,
  );
}
