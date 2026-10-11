import { BadgeCheck, ChevronRight, OctagonAlert, UserCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cx } from '../../../utils/cx';
import { formatPercent } from '../../../utils/format';
import { formatResult } from '../../../utils/grades';
import { fullName } from '../../../utils/names';

/**
 * One of a student's two figures. Both are always shown, so they can be compared down the list; the one that
 * put the student on it is set in bold oxblood ink, the other stays grey. No coloured tags: a list of alarms
 * reads as noise, a column of numbers reads at a glance.
 */
function FigureValue({ value, isBelow }) {
  return (
    <span className={cx('tabular text-sm', isBelow ? 'font-semibold text-attention-ink' : 'text-gray-600')}>
      {value}
    </span>
  );
}

const attendanceOf = (student) => formatPercent(student.attendance.rate);
const averageOf = (student) => formatResult(student.gradeAverage);
const isBelow = (student, reason) => student.reasons.includes(reason);

/** The small grey box with a chevron that opens a student, as on every card row link. */
function OpenStudent({ to, student, className }) {
  return (
    <Link
      to={to}
      aria-label={`Open ${fullName(student)}`}
      className={cx(
        'flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900',
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/** The full-width version (admin dashboard): one row per student, read across. Scrolls sideways on a phone. */
function AtRiskTable({ students, studentPath }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-600">
            <th scope="col" className="py-2 pl-5 font-medium">
              Student
            </th>
            <th scope="col" className="py-2 font-medium">
              Class
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Attendance
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Average
            </th>
            {studentPath && (
              <th scope="col" className="w-16 py-2 pr-5">
                <span className="sr-only">Open</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {students.map((student) => (
            <tr key={student.studentId}>
              <td className="py-3 pl-5">
                <span className="block text-[0.9375rem] font-medium text-gray-900">{fullName(student)}</span>
                <span className="block text-xs text-gray-600">{student.studentNumber}</span>
              </td>
              <td className="py-3 text-sm text-gray-700">{student.className}</td>
              <td className="py-3 text-right">
                <FigureValue value={attendanceOf(student)} isBelow={isBelow(student, 'attendance')} />
              </td>
              <td className="py-3 text-right">
                <FigureValue value={averageOf(student)} isBelow={isBelow(student, 'grades')} />
              </td>
              {studentPath && (
                <td className="py-3 pr-5">
                  <OpenStudent to={studentPath(student.studentId)} student={student} className="ml-auto" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A labelled figure for the narrow list. */
function Figure({ label, value, isBelow: below }) {
  return (
    <span className="flex flex-col items-end">
      <span className="text-[0.6875rem] tracking-wide text-gray-600 uppercase">{label}</span>
      <FigureValue value={value} isBelow={below} />
    </span>
  );
}

/** The narrow version (a dashboard column): name and class, then both figures on the right. */
function AtRiskList({ students, studentPath }) {
  return (
    <ul className="divide-y divide-gray-200">
      {students.map((student) => (
        <li key={student.studentId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium text-gray-900">{fullName(student)}</span>
            <span className="mt-0.5 block text-xs text-gray-600">
              {student.className} · <span className="whitespace-nowrap">{student.studentNumber}</span>
            </span>
          </span>
          <span className="flex shrink-0 gap-5">
            <Figure
              label="Attendance"
              value={attendanceOf(student)}
              isBelow={isBelow(student, 'attendance')}
            />
            <Figure label="Average" value={averageOf(student)} isBelow={isBelow(student, 'grades')} />
          </span>
          {studentPath && <OpenStudent to={studentPath(student.studentId)} student={student} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Needs attention" (payload `atRisk`): students whose attendance or general average this school year is
 * below the lines the API reports, worst first, each with both figures and the low one in oxblood ink.
 * Admins can open each student; teachers see the list only. The title square is oxblood with a warning only
 * while someone is on the list; with nobody below the line it turns sage with a check, so a good state never
 * looks like an alarm.
 *
 * @param {object} props
 * @param {{ attendanceRateBelow: number, gradeAverageBelow: number, total: number, students: object[] }} props.atRisk
 * @param {(studentId: number) => string} [props.studentPath] link of a row; rows are plain text without it
 * @param {'list'|'table'} [props.layout] `table` when the card spans the page, `list` in a column
 */
export function AtRiskCard({ atRisk, studentPath, layout = 'list' }) {
  const lines = `Below ${formatPercent(atRisk.attendanceRateBelow)} attendance or a ${formatResult(atRisk.gradeAverageBelow)} average this school year`;
  const hasStudents = atRisk.total > 0;
  const Rows = layout === 'table' ? AtRiskTable : AtRiskList;

  return (
    <Card
      icon={hasStudents ? OctagonAlert : BadgeCheck}
      mark={hasStudents ? 'oxblood' : 'sage'}
      title="Needs attention"
      total={atRisk.total > 0 ? atRisk.total : undefined}
      description={lines}
    >
      {atRisk.students.length === 0 ? (
        <EmptyState icon={UserCheck} title="Everyone is on track" compact />
      ) : (
        <>
          <Rows students={atRisk.students} studentPath={studentPath} />
          {atRisk.students.some((student) => isBelow(student, 'attendance')) && (
            <p className="mt-3 text-xs text-gray-600">Excused absences count as missed periods.</p>
          )}
          {atRisk.total > atRisk.students.length && (
            <p className="mt-3 text-xs text-gray-600">
              Showing the {atRisk.students.length} furthest below of {atRisk.total}.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
