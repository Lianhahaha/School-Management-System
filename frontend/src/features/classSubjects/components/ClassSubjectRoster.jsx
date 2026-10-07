import { Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PAGINATION } from '../../../constants/shared';
import { formatPercent } from '../../../utils/format';
import { formatResult } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { useAttendanceSummary } from '../../attendance/hooks';
import { useGradeSummary } from '../../grades/hooks';
import { useStudents } from '../../students/hooks';
import { StudentInSubjectModal } from './StudentInSubjectModal';

/**
 * Roster of the class a class-subject belongs to, with each student's attendance rate and result in this
 * subject ("—" while nothing is marked or graded). Each name opens the student's attendance and grades in
 * this subject. Read-only; fetches its own data.
 *
 * @param {object} props
 * @param {{ id: number, classId: number, className: string, subjectName: string }} props.classSubject
 */
export function ClassSubjectRoster({ classSubject }) {
  const students = useStudents({ classId: classSubject.classId, limit: PAGINATION.MAX_LIMIT });
  const rates = useAttendanceSummary({ classSubjectId: classSubject.id, groupBy: 'student' });
  const results = useGradeSummary({ classSubjectId: classSubject.id, groupBy: 'student' });
  const [openStudent, setOpenStudent] = useState(null);

  const rateByStudent = useMemo(
    () => new Map((Array.isArray(rates.data) ? rates.data : []).map((row) => [row.studentId, row.rate])),
    [rates.data],
  );
  const resultByStudent = useMemo(
    () =>
      new Map(
        (Array.isArray(results.data) ? results.data : []).map((row) => [row.studentId, row.percentage]),
      ),
    [results.data],
  );

  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (student) => (
        <button
          type="button"
          onClick={() => setOpenStudent(student)}
          className="link text-left"
          aria-label={`${fullName(student)}: attendance and grades in ${classSubject.subjectName}`}
        >
          {fullName(student)}
        </button>
      ),
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
    {
      key: 'result',
      header: 'Average',
      align: 'right',
      cell: (student) =>
        results.isSuccess ? (
          formatResult(resultByStudent.get(student.id) ?? null)
        ) : (
          <span aria-hidden="true">—</span>
        ),
    },
  ];

  return (
    <>
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
            description="Students show up here once an administrator enrolls them."
          />
        }
      />
      <StudentInSubjectModal
        student={openStudent}
        classSubject={classSubject}
        result={openStudent ? (resultByStudent.get(openStudent.id) ?? null) : null}
        onClose={() => setOpenStudent(null)}
      />
    </>
  );
}
