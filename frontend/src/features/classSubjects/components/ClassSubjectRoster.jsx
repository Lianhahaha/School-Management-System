import { Users } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PAGINATION } from '../../../constants/shared';
import { formatPercent } from '../../../utils/format';
import { fullName } from '../../../utils/names';
import { useAttendanceSummary } from '../../attendance/hooks';
import { useStudents } from '../../students/hooks';

/**
 * Roster of the class a class-subject belongs to, with each student's attendance rate in this
 * subject ("—" while nothing is marked). Read-only; fetches its own data.
 *
 * @param {object} props
 * @param {{ id: number, classId: number, className: string }} props.classSubject
 */
export function ClassSubjectRoster({ classSubject }) {
  const students = useStudents({ classId: classSubject.classId, limit: PAGINATION.MAX_LIMIT });
  const rates = useAttendanceSummary({ classSubjectId: classSubject.id, groupBy: 'student' });

  const rateByStudent = useMemo(
    () => new Map((Array.isArray(rates.data) ? rates.data : []).map((row) => [row.studentId, row.rate])),
    [rates.data],
  );

  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (student) => <span className="font-medium text-gray-900">{fullName(student)}</span>,
    },
    { key: 'studentNumber', header: 'Student no' },
    { key: 'guardianPhone', header: 'Guardian phone', hideBelow: 'md' },
    {
      key: 'rate',
      header: 'Attendance rate',
      align: 'right',
      cell: (student) =>
        rates.isSuccess ? (
          formatPercent(rateByStudent.get(student.id) ?? null)
        ) : (
          <span aria-hidden="true">—</span>
        ),
    },
  ];

  return (
    <DataTable
      label={`Students of ${classSubject.className}`}
      columns={columns}
      rows={students.data?.items ?? []}
      isLoading={students.isPending}
      isFetching={students.isFetching}
      error={students.error}
      onRetry={students.refetch}
      skeletonRows={6}
      emptyState={
        <EmptyState
          icon={Users}
          title="No students enrolled in this class"
          description="The roster fills up when an administrator enrolls students."
        />
      }
    />
  );
}
