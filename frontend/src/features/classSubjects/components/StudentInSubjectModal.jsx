import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ASSESSMENT_TYPE_LABELS } from '../../../constants/ui';
import { formatDate } from '../../../utils/date';
import { countOf, formatPercent, formatScore } from '../../../utils/format';
import { formatResult } from '../../../utils/grades';
import { fullName } from '../../../utils/names';
import { useAttendanceSummary } from '../../attendance/hooks';
import { useGrades } from '../../grades/hooks';

/** Attendance of the student in this lesson: rate and the four counts on one line. */
function AttendanceLine({ summary }) {
  if (!summary.total) return <p className="text-sm text-gray-600">Nothing marked yet.</p>;
  return (
    <p className="text-sm text-gray-700">
      <span className="text-2xl font-semibold text-gray-900">{formatPercent(summary.rate)}</span>{' '}
      {`over ${countOf(summary.total, 'lesson')}: ${summary.present} present, ${summary.absent} absent, ${summary.late} late, ${summary.excused} excused`}
    </p>
  );
}

/**
 * One student in one class-subject, for the teacher's roster: their attendance and every grade in this
 * subject, newest first, with the subject result. Read-only; fetches its own data when open.
 *
 * @param {object} props
 * @param {object|null} props.student a roster row; null closes the dialog
 * @param {{ id: number, subjectName: string, className: string }} props.classSubject
 * @param {number|null} [props.result] the student's result in this subject (percentage), from the roster
 * @param {() => void} props.onClose
 */
export function StudentInSubjectModal({ student, classSubject, result = null, onClose }) {
  const open = Boolean(student);
  const filters = { studentId: student?.id, classSubjectId: classSubject.id };
  const attendance = useAttendanceSummary(filters, { enabled: open });
  const grades = useGrades(
    { ...filters, sortBy: 'assessedOn', sortOrder: 'desc', limit: 100 },
    { enabled: open },
  );

  let gradeList;
  if (grades.error) {
    gradeList = (
      <ErrorState title="Couldn't load grades" message={grades.error.message} onRetry={grades.refetch} />
    );
  } else if (grades.isPending) {
    gradeList = <Skeleton className="h-24 w-full" />;
  } else if (grades.data.items.length === 0) {
    gradeList = <EmptyState title="No grades in this subject yet" compact />;
  } else {
    gradeList = (
      <ul className="divide-y divide-gray-200">
        {grades.data.items.map((grade) => (
          <li key={grade.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">
                {grade.assessment.title}
              </span>
              <span className="block text-xs text-gray-600">
                {ASSESSMENT_TYPE_LABELS[grade.assessment.type] ?? grade.assessment.type} ·{' '}
                {formatDate(grade.assessment.assessedOn)}
                {grade.remarks && ` · ${grade.remarks}`}
              </span>
            </span>
            <span className="tabular shrink-0 text-sm text-gray-900">
              {formatScore(grade.score, grade.assessment.maxScore)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? fullName(student) : ''}
      description={`${classSubject.subjectName} · ${classSubject.className}${student ? ` · ${student.studentNumber}` : ''}`}
    >
      <div className="space-y-6">
        <section aria-labelledby="student-subject-attendance">
          <h3 id="student-subject-attendance" className="mb-2 text-sm font-semibold text-gray-900">
            Attendance
          </h3>
          {attendance.error ? (
            <ErrorState
              title="Couldn't load attendance"
              message={attendance.error.message}
              onRetry={attendance.refetch}
            />
          ) : attendance.isPending ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <AttendanceLine summary={attendance.data} />
          )}
        </section>
        <section aria-labelledby="student-subject-grades">
          <h3
            id="student-subject-grades"
            className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold text-gray-900"
          >
            Grades
            <span className="text-sm font-normal text-gray-600">Result {formatResult(result)}</span>
          </h3>
          {gradeList}
        </section>
      </div>
    </Modal>
  );
}
