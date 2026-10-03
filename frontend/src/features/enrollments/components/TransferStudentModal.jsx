import { fullName } from '../../../utils/names';
import { useTransferStudent } from '../hooks';
import { ClassPickerModal } from './ClassPickerModal';

/**
 * Move an enrolled student to another class (POST /enrollments/transfer): the backend closes the old
 * enrollment as `transferred` and opens the new one in one transaction. Used by the students list and
 * the student detail page. The student's current class is not offered. Closes itself after success.
 *
 * @param {object} props
 * @param {{ id: number, firstName: string, lastName: string, currentEnrollment: { classId: number, className: string }|null }|null} props.student
 *   the student row (as returned by useStudents); null while closed
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function TransferStudentModal({ student, open, onClose }) {
  const mutation = useTransferStudent();
  const current = student?.currentEnrollment;
  return (
    <ClassPickerModal
      student={student}
      open={open}
      onClose={onClose}
      title="Transfer student"
      description={
        student
          ? `${fullName(student)} is in ${current?.className ?? 'no class'}. Choose the new class.`
          : undefined
      }
      submitLabel="Transfer"
      mutation={mutation}
      excludeIds={current ? [current.classId] : undefined}
    />
  );
}
