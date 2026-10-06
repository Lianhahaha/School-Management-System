import { ShieldCheck, TriangleAlert, UserCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatPercent } from '../../../utils/format';
import { formatResult } from '../../../utils/grades';
import { fullName } from '../../../utils/names';

/** What a row shows: the student, their class and the figures that put them on the list. */
function StudentSummary({ student }) {
  return (
    <>
      <p className="text-sm font-medium text-gray-900">{fullName(student)}</p>
      <p className="mt-0.5 text-xs text-gray-600">
        {student.className} · {student.studentNumber}
      </p>
      <p className="mt-1.5 flex flex-wrap gap-1.5">
        {student.reasons.includes('attendance') && (
          <Badge tone="red">
            Attendance {formatPercent(student.attendance.rate)} · {student.attendance.marks} marks
          </Badge>
        )}
        {student.reasons.includes('grades') && (
          <Badge tone="amber">Average {formatResult(student.gradeAverage)}</Badge>
        )}
      </p>
    </>
  );
}

/**
 * "Needs attention" (payload `atRisk`): students whose attendance or general average this school year is
 * below the lines the API reports, worst first. Admins can open each student; teachers see the list only.
 * The title square is brick with a warning only while someone is on the list; with nobody below the line it
 * turns leaf with a check, so a good state never looks like an alarm.
 *
 * @param {object} props
 * @param {{ attendanceRateBelow: number, gradeAverageBelow: number, total: number, students: object[] }} props.atRisk
 * @param {(studentId: number) => string} [props.studentPath] link of a row; rows are plain text without it
 */
export function AtRiskCard({ atRisk, studentPath }) {
  const lines = `Below ${formatPercent(atRisk.attendanceRateBelow)} attendance or a ${formatResult(atRisk.gradeAverageBelow)} average this school year`;
  const hasStudents = atRisk.total > 0;

  return (
    <Card
      icon={hasStudents ? TriangleAlert : ShieldCheck}
      mark={hasStudents ? 'brick' : 'leaf'}
      title="Needs attention"
      total={atRisk.total > 0 ? atRisk.total : undefined}
      description={lines}
    >
      {atRisk.students.length === 0 ? (
        <EmptyState icon={UserCheck} title="Everyone is on track" compact />
      ) : (
        <>
          <ul className="divide-y divide-gray-200">
            {atRisk.students.map((student) => (
              <li key={student.studentId} className="py-3 first:pt-0 last:pb-0">
                {studentPath ? (
                  <Link
                    to={studentPath(student.studentId)}
                    className="-mx-3 block rounded-2xl px-3 py-2 transition-colors hover:bg-gray-100"
                  >
                    <StudentSummary student={student} />
                  </Link>
                ) : (
                  <StudentSummary student={student} />
                )}
              </li>
            ))}
          </ul>
          {atRisk.students.some((student) => student.reasons.includes('attendance')) && (
            <p className="mt-3 text-xs text-gray-600">Excused absences count as missed lessons.</p>
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
