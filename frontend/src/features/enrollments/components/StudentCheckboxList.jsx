import { Checkbox } from '../../../components/ui/Checkbox';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { fullName } from '../../../utils/names';

/**
 * A scrolling box of students with a checkbox each ("Name · student number"), with loading, error and empty
 * states. The modals that pick students (enroll many, end of school year) own the data and the selection.
 *
 * @param {object} props
 * @param {string} props.label accessible name of the group
 * @param {Array<{ id: number, firstName: string, lastName: string, studentNumber: string }>} props.students
 * @param {boolean} props.isPending
 * @param {Error | null} props.error
 * @param {() => void} props.onRetry
 * @param {(student: object) => boolean} props.isChecked
 * @param {(student: object) => void} props.onToggle
 * @param {string} props.emptyText shown when there is no student
 */
export function StudentCheckboxList({
  label,
  students,
  isPending,
  error,
  onRetry,
  isChecked,
  onToggle,
  emptyText,
}) {
  let body;
  if (isPending) {
    body = (
      <div role="status" aria-label="Loading students" className="space-y-3 p-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-2/3" />
        ))}
      </div>
    );
  } else if (error) {
    body = <ErrorState title="Couldn't load students" message={error.message} onRetry={onRetry} />;
  } else if (students.length === 0) {
    body = <p className="p-6 text-center text-sm text-gray-600">{emptyText}</p>;
  } else {
    body = (
      <ul className="divide-y divide-gray-200">
        {students.map((student) => (
          <li key={student.id} className="px-3 py-2">
            <Checkbox
              label={`${fullName(student)} · ${student.studentNumber}`}
              checked={isChecked(student)}
              onChange={() => onToggle(student)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div role="group" aria-label={label} className="max-h-72 overflow-y-auto rounded-[1.25rem] bg-gray-50">
      {body}
    </div>
  );
}
