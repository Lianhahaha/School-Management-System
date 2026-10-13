import { Award, ClipboardList, Users } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { StatTile } from '../../../components/ui/StatTile';
import { academicYearToDate } from '../../../utils/date';
import { countOf, formatPercent } from '../../../utils/format';
import { formatResult, generalAverage } from '../../../utils/grades';
import { ApplicationCard } from '../../admissions/components/ApplicationCard';
import { isApplicant } from '../../admissions/status';
import { useAttendanceSummary } from '../../attendance/hooks';
import { useSemesterSummaries } from '../../grades/hooks';

/**
 * The hint under a figure whose data has not arrived: loading, or a failed load said plainly, so a failure never
 * reads as "nothing this school year". The tile opens the tab, where the panel offers Retry.
 * @param {{ isError: boolean }} query
 * @param {string} what for example 'grades'
 */
const waitingHint = (query, what) => (query.isError ? `Couldn't load the ${what}` : 'Loading…');

/**
 * The first tab of a student's page: what an admin usually opens it for. Class, attendance and average of the
 * current school year as figure rows (each opening the tab with the detail), then how to reach the student,
 * and the application of a self-registered student (first while it waits).
 * The year is the one the student's own pages open on (enrollments/schoolYears defaultSchoolYear): the class's
 * year, this year while the class is next year's (placed at the end of the year), else the current year.
 *
 * @param {object} props
 * @param {object} props.student GET /students/:id data
 * @param {string} props.academicYear the school year of the attendance and average figures
 * @param {(tab: string) => void} props.onOpenTab switches to another tab of the page
 */
export function StudentOverview({ student, academicYear, onOpenTab }) {
  const enrollment = student.currentEnrollment;
  // The same dates as the Attendance tab the tile opens (StudentDetailPage).
  const attendance = useAttendanceSummary({ studentId: student.id, ...academicYearToDate(academicYear) });
  // Both semesters of the year, tagged: the year's general average puts the semesters (and a subject's two
  // classes) together exactly as the API does.
  const grades = useSemesterSummaries({ studentId: student.id, academicYear });

  const rowsThisYear = grades.data ?? [];
  const subjectCount = new Set(rowsThisYear.map((row) => row.subjectId)).size;
  const average = generalAverage(rowsThisYear);
  const marks = attendance.data?.total ?? 0;
  // A self-registered student's application: on top while they have not picked a class, below once admitted.
  const application = student.admission && <ApplicationCard student={student} />;
  const applicationFirst = isApplicant(student);

  return (
    <div className="space-y-6">
      {applicationFirst && application}
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Class"
          value={enrollment ? enrollment.className : '—'}
          hint={enrollment ? enrollment.academicYear : 'Not in a class'}
          icon={Users}
          mark="cream"
          to={enrollment ? `/admin/classes/${enrollment.classId}` : undefined}
        />
        <StatTile
          label="Attendance"
          value={attendance.isPending ? '…' : formatPercent(attendance.data?.rate ?? null)}
          hint={
            attendance.data === undefined
              ? waitingHint(attendance, 'attendance')
              : marks
                ? `${countOf(marks, 'mark')} this school year`
                : 'Nothing marked this school year'
          }
          icon={ClipboardList}
          mark="sage"
          onClick={() => onOpenTab('attendance')}
        />
        <StatTile
          label="Average"
          value={grades.isPending ? '…' : formatResult(average)}
          hint={
            grades.data === undefined
              ? waitingHint(grades, 'grades')
              : subjectCount
                ? `${countOf(subjectCount, 'subject')} this school year`
                : 'No grades this school year'
          }
          icon={Award}
          mark="cream"
          onClick={() => onOpenTab('grades')}
        />
      </div>

      <Card title="Contact">
        <DescriptionList
          items={[
            { label: 'Email', value: student.email },
            { label: 'Phone', value: student.phone || '—' },
            { label: 'Guardian', value: student.guardianName || '—' },
            { label: 'Guardian phone', value: student.guardianPhone || '—' },
            { label: 'Address', value: student.address || '—' },
          ]}
        />
      </Card>
      {!applicationFirst && application}
    </div>
  );
}
