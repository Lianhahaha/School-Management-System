import { Award, ClipboardCheck, School } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { StatTile } from '../../../components/ui/StatTile';
import { academicYearStart, currentAcademicYear, todayYmd } from '../../../utils/date';
import { countOf, formatPercent } from '../../../utils/format';
import { averageOf, formatResult } from '../../../utils/grades';
import { useAttendanceSummary } from '../../attendance/hooks';
import { useGradeSummary } from '../../grades/hooks';

/**
 * The first tab of a student's page: what an admin usually opens it for. Class, attendance and average of the
 * current school year as figure rows (each opening the tab with the detail), then how to reach the student.
 * The year is the student's class year, or the current one while they have no class.
 *
 * @param {object} props
 * @param {object} props.student GET /students/:id data
 * @param {(tab: string) => void} props.onOpenTab switches to another tab of the page
 */
export function StudentOverview({ student, onOpenTab }) {
  const enrollment = student.currentEnrollment;
  const academicYear = enrollment?.academicYear ?? currentAcademicYear();
  const yearStart = academicYearStart(academicYear);
  const today = todayYmd();
  const attendance = useAttendanceSummary({
    studentId: student.id,
    dateFrom: yearStart <= today ? yearStart : today,
    dateTo: today,
  });
  const grades = useGradeSummary({ studentId: student.id, groupBy: 'classSubject' });

  const subjectsThisYear = (grades.data ?? []).filter((subject) => subject.academicYear === academicYear);
  const average = averageOf(subjectsThisYear.map((subject) => subject.percentage));
  const marks = attendance.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Class"
          value={enrollment ? enrollment.className : '—'}
          hint={enrollment ? `School year ${enrollment.academicYear}` : 'Not in a class'}
          icon={School}
          mark="umber"
          to={enrollment ? `/admin/classes/${enrollment.classId}` : undefined}
        />
        <StatTile
          label="Attendance"
          value={attendance.isPending ? '…' : formatPercent(attendance.data?.rate ?? null)}
          hint={marks ? `${countOf(marks, 'mark')} this school year` : 'Nothing marked this school year'}
          icon={ClipboardCheck}
          mark="leaf"
          onClick={() => onOpenTab('attendance')}
        />
        <StatTile
          label="Average"
          value={grades.isPending ? '…' : formatResult(average)}
          hint={
            subjectsThisYear.length
              ? `${countOf(subjectsThisYear.length, 'subject')} this school year`
              : 'No grades this school year'
          }
          icon={Award}
          mark="plum"
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
    </div>
  );
}
