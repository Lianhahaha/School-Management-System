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
 * this subject. Read-only; fetches its own data: the students, their rates and their results. The table waits
 * for all three, and a first load that failed shows the table's error state with Retry, because a "—" in every
 * row would read as "nothing marked or graded yet".
 *
 * @param {object} props
 * @param {{ id: number, classId: number, className: string, subjectName: string }} props.classSubject
 */
export function ClassSubjectRoster({ classSubject }) {
  const students = useStudents({ classId: classSubject.classId, limit: PAGINATION.MAX_LIMIT });
  const rates = useAttendanceSummary({ classSubjectId: classSubject.id, groupBy: 'student' });
  const results = useGradeSummary({ classSubjectId: classSubject.id, groupBy: 'student' });
  const [openStudent, setOpenStudent] = useState(null);

  const queries = [students, rates, results];
  const failed = queries.find((query) => query.error && query.data === undefined)?.error ?? null;
  const retry = () => queries.filter((query) => query.isError).forEach((query) => query.refetch());

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
      cell: (student) => formatPercent(rateByStudent.get(student.id) ?? null),
    },
    {
      key: 'result',
      header: 'Average',
      align: 'right',
      cell: (student) => formatResult(resultByStudent.get(student.id) ?? null),
    },
  ];

  return (
    <>
      <DataTable
        label={`Students of ${classSubject.className}`}
        columns={columns}
        rows={failed ? [] : (students.data?.items ?? [])}
        isLoading={queries.some((query) => query.isPending)}
        isFetching={students.isFetching}
        error={failed}
        onRetry={retry}
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
